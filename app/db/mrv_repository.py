"""MRV inventory persistence repositories."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol
from uuid import uuid4

from app.config import get_settings


@dataclass
class MRVRecord:
    inventory_id: str
    tenant_id: str
    user_id: str
    facility_id: str
    period: str
    operator: str
    asset: str
    status: str
    tier_readiness_pct: float
    gap_count: int
    total_co2e_tonnes: float
    audit_sha256: str
    request: dict[str, Any]
    response: dict[str, Any]
    created_utc: str

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class MRVRepository(Protocol):
    def save(self, *, tenant_id: str, user_id: str, request: dict[str, Any],
             response: dict[str, Any]) -> MRVRecord:
        ...

    def list_records(self, *, tenant_id: str) -> list[dict[str, Any]]:
        ...

    def get(self, *, tenant_id: str, inventory_id: str) -> dict[str, Any] | None:
        ...


class LocalJsonMRVRepository:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    def save(self, *, tenant_id: str, user_id: str, request: dict[str, Any],
             response: dict[str, Any]) -> MRVRecord:
        record = _record_from_payload(
            tenant_id=tenant_id, user_id=user_id, request=request, response=response,
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record.as_dict(), sort_keys=True) + "\n")
        return record

    def list_records(self, *, tenant_id: str) -> list[dict[str, Any]]:
        rows = [
            _summary(r) for r in self._read_all()
            if r.get("tenant_id") == tenant_id
        ]
        return sorted(rows, key=lambda r: r["created_utc"], reverse=True)

    def get(self, *, tenant_id: str, inventory_id: str) -> dict[str, Any] | None:
        for record in self._read_all():
            if record.get("tenant_id") == tenant_id and record.get("inventory_id") == inventory_id:
                return record
        return None

    def _read_all(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        records = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                records.append(json.loads(line))
        return records


_MRV_SUMMARY_COLS = (
    "inventory_id, facility_id, period, operator, asset, status, "
    "tier_readiness_pct, gap_count, total_co2e_tonnes, audit_sha256, created_utc"
)
_MRV_FULL_COLS = (
    "inventory_id, tenant_id, user_id, facility_id, period, operator, asset, status, "
    "tier_readiness_pct, gap_count, total_co2e_tonnes, audit_sha256, request, response, "
    "created_utc"
)


class PostgresMRVRepository:
    """Postgres backend for mrv_inventories (migration 007), drop-in compatible
    with :class:`LocalJsonMRVRepository`. Tenant isolation via explicit WHERE
    filter + the petrobrain.tenant_id GUC (RLS backstop)."""

    def __init__(self, dsn: str | None = None) -> None:
        self.dsn = dsn

    def save(self, *, tenant_id: str, user_id: str, request: dict[str, Any],
             response: dict[str, Any]) -> MRVRecord:
        from psycopg.types.json import Json

        record = _record_from_payload(
            tenant_id=tenant_id, user_id=user_id, request=request, response=response,
        )
        with self._conn(tenant_id) as conn:
            row = conn.execute(
                f"INSERT INTO mrv_inventories (inventory_id, tenant_id, user_id, facility_id, "
                f" period, operator, asset, status, tier_readiness_pct, gap_count, "
                f" total_co2e_tonnes, audit_sha256, request, response, created_utc) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                f"RETURNING {_MRV_FULL_COLS}",
                (
                    record.inventory_id, tenant_id, user_id, record.facility_id, record.period,
                    record.operator, record.asset, record.status, record.tier_readiness_pct,
                    record.gap_count, record.total_co2e_tonnes, record.audit_sha256,
                    Json(request), Json(response), record.created_utc,
                ),
            ).fetchone()
        return _record_from_row(row)

    def list_records(self, *, tenant_id: str) -> list[dict[str, Any]]:
        with self._conn(tenant_id) as conn:
            rows = conn.execute(
                f"SELECT {_MRV_SUMMARY_COLS} FROM mrv_inventories WHERE tenant_id = %s "
                f"ORDER BY created_utc DESC",
                (tenant_id,),
            ).fetchall()
        return [_serialize_mrv(r) for r in rows]

    def get(self, *, tenant_id: str, inventory_id: str) -> dict[str, Any] | None:
        with self._conn(tenant_id) as conn:
            row = conn.execute(
                f"SELECT {_MRV_FULL_COLS} FROM mrv_inventories "
                f"WHERE tenant_id = %s AND inventory_id = %s",
                (tenant_id, inventory_id),
            ).fetchone()
        return _serialize_mrv(row) if row else None

    def _conn(self, tenant_id: str):
        from app.db import pg

        return pg.tenant_connection(tenant_id, dsn=self.dsn, dict_rows=True)


def _serialize_mrv(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    created = out.get("created_utc")
    if created is not None and not isinstance(created, str):
        out["created_utc"] = created.isoformat()
    return out


def _record_from_row(row: dict[str, Any]) -> MRVRecord:
    data = _serialize_mrv(row)
    return MRVRecord(
        inventory_id=data["inventory_id"], tenant_id=data["tenant_id"],
        user_id=data["user_id"], facility_id=data["facility_id"], period=data["period"],
        operator=data["operator"], asset=data["asset"], status=data["status"],
        tier_readiness_pct=data["tier_readiness_pct"], gap_count=data["gap_count"],
        total_co2e_tonnes=data["total_co2e_tonnes"], audit_sha256=data["audit_sha256"],
        request=dict(data.get("request") or {}), response=dict(data.get("response") or {}),
        created_utc=data["created_utc"],
    )


def get_mrv_repository() -> MRVRepository:
    settings = get_settings()
    if settings.persistence_backend == "local_json":
        return LocalJsonMRVRepository(settings.mrv_store_path)
    if settings.persistence_backend == "postgres":
        return PostgresMRVRepository(settings.database_url)
    raise ValueError(f"unknown persistence backend {settings.persistence_backend}")


def _record_from_payload(*, tenant_id: str, user_id: str, request: dict[str, Any],
                         response: dict[str, Any]) -> MRVRecord:
    inventory = response["inventory"]
    readiness = response["mrv_readiness"]
    return MRVRecord(
        inventory_id=str(uuid4()),
        tenant_id=tenant_id,
        user_id=user_id,
        facility_id=inventory["facility_id"],
        period=inventory["period"],
        operator=request["operator"],
        asset=request["asset"],
        status=readiness["status"],
        tier_readiness_pct=readiness["tier_readiness_pct"],
        gap_count=readiness["gap_count"],
        total_co2e_tonnes=readiness["total_co2e_tonnes"],
        audit_sha256=readiness["audit_sha256"],
        request=request,
        response=response,
        created_utc=datetime.now(timezone.utc).isoformat(),
    )


def _summary(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "inventory_id": record["inventory_id"],
        "facility_id": record["facility_id"],
        "period": record["period"],
        "operator": record["operator"],
        "asset": record["asset"],
        "status": record["status"],
        "tier_readiness_pct": record["tier_readiness_pct"],
        "gap_count": record["gap_count"],
        "total_co2e_tonnes": record["total_co2e_tonnes"],
        "audit_sha256": record["audit_sha256"],
        "created_utc": record["created_utc"],
    }
