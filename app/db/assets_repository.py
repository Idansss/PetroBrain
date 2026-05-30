"""
Asset hierarchy + relationships repository (A9 knowledge graph v1).

Phase-1 backend stores assets as JSONL and rewrites on update; the Postgres
backend (003_assets.sql) is the production swap point. Both enforce tenant
isolation: every query takes a tenant_id and refuses empty values; the
Postgres path adds RLS as defence in depth.

The store mirrors the production schema exactly so swapping backends does
not change the application contract.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

from app.config import get_settings


@dataclass
class AssetRecord:
    id: str
    tenant_id: str
    parent_id: str | None
    type: str
    name: str
    attributes: dict[str, Any] = field(default_factory=dict)
    created_utc: str = ""
    updated_utc: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AssetRelationshipRecord:
    id: int
    tenant_id: str
    src_id: str
    dst_id: str
    relation: str
    attributes: dict[str, Any] = field(default_factory=dict)
    created_utc: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class LocalJsonAssetsRepository:
    """JSONL repository, single-process. Postgres backend is the swap point."""

    def __init__(self, assets_path: str | Path, relationships_path: str | Path) -> None:
        self.assets_path = Path(assets_path)
        self.relationships_path = Path(relationships_path)
        self._lock = Lock()

    # ---- asset CRUD ---------------------------------------------------------

    def create(
        self,
        *,
        tenant_id: str,
        type: str,
        name: str,
        parent_id: str | None = None,
        attributes: dict[str, Any] | None = None,
        asset_id: str | None = None,
    ) -> AssetRecord:
        _require_tenant(tenant_id)
        if not type or not name:
            raise ValueError("type and name are required")
        with self._lock:
            assets = self._read_assets_locked()
            if parent_id is not None:
                parent = _find(assets, tenant_id=tenant_id, asset_id=parent_id)
                if parent is None:
                    raise ValueError(f"parent {parent_id} not found in tenant {tenant_id}")
            now = _now()
            record = AssetRecord(
                id=asset_id or str(uuid4()),
                tenant_id=tenant_id,
                parent_id=parent_id,
                type=type,
                name=name,
                attributes=dict(attributes or {}),
                created_utc=now,
                updated_utc=now,
            )
            if any(a["id"] == record.id for a in assets):
                raise ValueError(f"asset id {record.id} already exists")
            assets.append(record.as_dict())
            self._write_assets_locked(assets)
        return record

    def update(
        self,
        *,
        tenant_id: str,
        asset_id: str,
        type: str | None = None,
        name: str | None = None,
        parent_id: str | None = None,
        attributes: dict[str, Any] | None = None,
        clear_parent: bool = False,
    ) -> AssetRecord:
        _require_tenant(tenant_id)
        with self._lock:
            assets = self._read_assets_locked()
            row = _find(assets, tenant_id=tenant_id, asset_id=asset_id)
            if row is None:
                raise KeyError(f"asset {asset_id} not found in tenant {tenant_id}")
            if type is not None:
                if not type:
                    raise ValueError("type must not be empty")
                row["type"] = type
            if name is not None:
                if not name:
                    raise ValueError("name must not be empty")
                row["name"] = name
            if clear_parent:
                row["parent_id"] = None
            elif parent_id is not None:
                if parent_id == asset_id:
                    raise ValueError("an asset cannot be its own parent")
                parent = _find(assets, tenant_id=tenant_id, asset_id=parent_id)
                if parent is None:
                    raise ValueError(f"parent {parent_id} not found in tenant {tenant_id}")
                # Detect cycles: walk parent chain, refusing if asset_id is encountered.
                cursor: dict[str, Any] | None = parent
                while cursor is not None:
                    if cursor["id"] == asset_id:
                        raise ValueError("cannot reparent: would create a cycle")
                    next_id = cursor.get("parent_id")
                    cursor = _find(assets, tenant_id=tenant_id, asset_id=next_id) if next_id else None
                row["parent_id"] = parent_id
            if attributes is not None:
                row["attributes"] = dict(attributes)
            row["updated_utc"] = _now()
            self._write_assets_locked(assets)
            return _row_to_asset(row)

    def get(self, *, tenant_id: str, asset_id: str) -> AssetRecord | None:
        _require_tenant(tenant_id)
        row = _find(self._read_assets(), tenant_id=tenant_id, asset_id=asset_id)
        return _row_to_asset(row) if row is not None else None

    def list_records(
        self,
        *,
        tenant_id: str,
        parent_id: str | None = None,
        roots_only: bool = False,
        type: str | None = None,
    ) -> list[AssetRecord]:
        _require_tenant(tenant_id)
        rows = [a for a in self._read_assets() if a["tenant_id"] == tenant_id]
        if roots_only:
            rows = [a for a in rows if a.get("parent_id") is None]
        elif parent_id is not None:
            rows = [a for a in rows if a.get("parent_id") == parent_id]
        if type is not None:
            rows = [a for a in rows if a.get("type") == type]
        rows.sort(key=lambda a: (a.get("type", ""), a.get("name", "")))
        return [_row_to_asset(r) for r in rows]

    def descendants(self, *, tenant_id: str, asset_id: str) -> list[AssetRecord]:
        _require_tenant(tenant_id)
        assets = [a for a in self._read_assets() if a["tenant_id"] == tenant_id]
        by_parent: dict[str | None, list[dict[str, Any]]] = {}
        for a in assets:
            by_parent.setdefault(a.get("parent_id"), []).append(a)
        result: list[AssetRecord] = []
        stack = list(by_parent.get(asset_id, []))
        while stack:
            row = stack.pop(0)
            result.append(_row_to_asset(row))
            stack.extend(by_parent.get(row["id"], []))
        result.sort(key=lambda a: (a.type, a.name))
        return result

    def path_to_root(self, *, tenant_id: str, asset_id: str) -> list[AssetRecord]:
        """Return [root, ..., asset]. Empty list if the asset is not found."""
        _require_tenant(tenant_id)
        assets = self._read_assets()
        rows: list[dict[str, Any]] = []
        current = _find(assets, tenant_id=tenant_id, asset_id=asset_id)
        seen: set[str] = set()
        while current is not None:
            if current["id"] in seen:                    # cycle guard (should be unreachable)
                break
            seen.add(current["id"])
            rows.append(current)
            parent_id = current.get("parent_id")
            current = _find(assets, tenant_id=tenant_id, asset_id=parent_id) if parent_id else None
        return [_row_to_asset(r) for r in reversed(rows)]

    # ---- relationships ------------------------------------------------------

    def create_relationship(
        self,
        *,
        tenant_id: str,
        src_id: str,
        dst_id: str,
        relation: str,
        attributes: dict[str, Any] | None = None,
    ) -> AssetRelationshipRecord:
        _require_tenant(tenant_id)
        if not relation:
            raise ValueError("relation must not be empty")
        if src_id == dst_id:
            raise ValueError("src_id and dst_id must differ")
        with self._lock:
            assets = self._read_assets_locked()
            if _find(assets, tenant_id=tenant_id, asset_id=src_id) is None:
                raise ValueError(f"src asset {src_id} not found in tenant {tenant_id}")
            if _find(assets, tenant_id=tenant_id, asset_id=dst_id) is None:
                raise ValueError(f"dst asset {dst_id} not found in tenant {tenant_id}")
            edges = self._read_relationships_locked()
            for edge in edges:
                if (
                    edge["tenant_id"] == tenant_id
                    and edge["src_id"] == src_id
                    and edge["dst_id"] == dst_id
                    and edge["relation"] == relation
                ):
                    raise ValueError("duplicate relationship")
            next_id = max((e["id"] for e in edges), default=0) + 1
            row = AssetRelationshipRecord(
                id=next_id,
                tenant_id=tenant_id,
                src_id=src_id,
                dst_id=dst_id,
                relation=relation,
                attributes=dict(attributes or {}),
                created_utc=_now(),
            )
            edges.append(row.as_dict())
            self._write_relationships_locked(edges)
            return row

    def list_relationships(
        self,
        *,
        tenant_id: str,
        asset_id: str | None = None,
        relation: str | None = None,
    ) -> list[AssetRelationshipRecord]:
        _require_tenant(tenant_id)
        rows = [r for r in self._read_relationships() if r["tenant_id"] == tenant_id]
        if asset_id is not None:
            rows = [r for r in rows if r["src_id"] == asset_id or r["dst_id"] == asset_id]
        if relation is not None:
            rows = [r for r in rows if r["relation"] == relation]
        rows.sort(key=lambda r: r["id"])
        return [AssetRelationshipRecord(**r) for r in rows]

    # ---- IO -----------------------------------------------------------------

    def _read_assets(self) -> list[dict[str, Any]]:
        with self._lock:
            return self._read_assets_locked()

    def _read_assets_locked(self) -> list[dict[str, Any]]:
        return _read_jsonl(self.assets_path)

    def _write_assets_locked(self, rows: list[dict[str, Any]]) -> None:
        _write_jsonl(self.assets_path, rows)

    def _read_relationships(self) -> list[dict[str, Any]]:
        with self._lock:
            return self._read_relationships_locked()

    def _read_relationships_locked(self) -> list[dict[str, Any]]:
        return _read_jsonl(self.relationships_path)

    def _write_relationships_locked(self, rows: list[dict[str, Any]]) -> None:
        _write_jsonl(self.relationships_path, rows)


_ASSET_COLS = "id, tenant_id, parent_id, type, name, attributes, created_utc, updated_utc"
_REL_COLS = "id, tenant_id, src_id, dst_id, relation, attributes, created_utc"


class PostgresAssetsRepository:
    """Postgres backend for the assets + asset_relationships tables (migration
    003), drop-in compatible with :class:`LocalJsonAssetsRepository`. Returns the
    same ``AssetRecord`` / ``AssetRelationshipRecord`` dataclasses.

    Tenant isolation: every connection sets the ``petrobrain.tenant_id`` GUC
    (RLS backstop) and every statement is tenant-scoped, so the recursive
    traversals can never cross tenants. Hierarchy traversal and cycle detection
    use recursive CTEs rather than reading the whole table into memory.
    """

    def __init__(self, dsn: str | None = None) -> None:
        self.dsn = dsn

    # ---- asset CRUD ---------------------------------------------------------

    def create(self, *, tenant_id: str, type: str, name: str,
               parent_id: str | None = None,
               attributes: dict[str, Any] | None = None,
               asset_id: str | None = None) -> AssetRecord:
        _require_tenant(tenant_id)
        if not type or not name:
            raise ValueError("type and name are required")
        from psycopg import errors
        from psycopg.types.json import Json

        new_id = asset_id or str(uuid4())
        with self._conn(tenant_id) as conn:
            if parent_id is not None and not self._exists(conn, parent_id):
                raise ValueError(f"parent {parent_id} not found in tenant {tenant_id}")
            try:
                row = conn.execute(
                    f"INSERT INTO assets (id, tenant_id, parent_id, type, name, attributes) "
                    f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING {_ASSET_COLS}",
                    (new_id, tenant_id, parent_id, type, name, Json(dict(attributes or {}))),
                ).fetchone()
            except errors.UniqueViolation as exc:
                raise ValueError(f"asset id {new_id} already exists") from exc
        return _asset_from_row(row)

    def update(self, *, tenant_id: str, asset_id: str,
               type: str | None = None, name: str | None = None,
               parent_id: str | None = None,
               attributes: dict[str, Any] | None = None,
               clear_parent: bool = False) -> AssetRecord:
        _require_tenant(tenant_id)
        from psycopg.types.json import Json

        with self._conn(tenant_id) as conn:
            if not self._exists(conn, asset_id):
                raise KeyError(f"asset {asset_id} not found in tenant {tenant_id}")
            sets: list[str] = []
            params: list[Any] = []
            if type is not None:
                if not type:
                    raise ValueError("type must not be empty")
                sets.append("type = %s")
                params.append(type)
            if name is not None:
                if not name:
                    raise ValueError("name must not be empty")
                sets.append("name = %s")
                params.append(name)
            if clear_parent:
                sets.append("parent_id = NULL")
            elif parent_id is not None:
                if parent_id == asset_id:
                    raise ValueError("an asset cannot be its own parent")
                if not self._exists(conn, parent_id):
                    raise ValueError(f"parent {parent_id} not found in tenant {tenant_id}")
                if self._is_ancestor(conn, tenant_id, ancestor=asset_id, of=parent_id):
                    raise ValueError("cannot reparent: would create a cycle")
                sets.append("parent_id = %s")
                params.append(parent_id)
            if attributes is not None:
                sets.append("attributes = %s")
                params.append(Json(dict(attributes)))
            sets.append("updated_utc = now()")
            params.extend([tenant_id, asset_id])
            row = conn.execute(
                f"UPDATE assets SET {', '.join(sets)} "
                f"WHERE tenant_id = %s AND id = %s RETURNING {_ASSET_COLS}",
                params,
            ).fetchone()
        return _asset_from_row(row)

    def get(self, *, tenant_id: str, asset_id: str) -> AssetRecord | None:
        _require_tenant(tenant_id)
        with self._conn(tenant_id) as conn:
            row = conn.execute(
                f"SELECT {_ASSET_COLS} FROM assets WHERE tenant_id = %s AND id = %s",
                (tenant_id, asset_id),
            ).fetchone()
        return _asset_from_row(row) if row else None

    def list_records(self, *, tenant_id: str, parent_id: str | None = None,
                     roots_only: bool = False, type: str | None = None) -> list[AssetRecord]:
        _require_tenant(tenant_id)
        clauses = ["tenant_id = %s"]
        params: list[Any] = [tenant_id]
        if roots_only:
            clauses.append("parent_id IS NULL")
        elif parent_id is not None:
            clauses.append("parent_id = %s")
            params.append(parent_id)
        if type is not None:
            clauses.append("type = %s")
            params.append(type)
        with self._conn(tenant_id) as conn:
            rows = conn.execute(
                f"SELECT {_ASSET_COLS} FROM assets WHERE {' AND '.join(clauses)} "
                f"ORDER BY type, name",
                params,
            ).fetchall()
        return [_asset_from_row(r) for r in rows]

    def descendants(self, *, tenant_id: str, asset_id: str) -> list[AssetRecord]:
        _require_tenant(tenant_id)
        sql = (
            "WITH RECURSIVE sub AS ("
            f"  SELECT {_ASSET_COLS} FROM assets WHERE tenant_id = %s AND parent_id = %s"
            "  UNION ALL"
            "  SELECT a.id, a.tenant_id, a.parent_id, a.type, a.name, a.attributes,"
            "         a.created_utc, a.updated_utc"
            "  FROM assets a JOIN sub ON a.parent_id = sub.id WHERE a.tenant_id = %s"
            f") SELECT {_ASSET_COLS} FROM sub ORDER BY type, name"
        )
        with self._conn(tenant_id) as conn:
            rows = conn.execute(sql, (tenant_id, asset_id, tenant_id)).fetchall()
        return [_asset_from_row(r) for r in rows]

    def path_to_root(self, *, tenant_id: str, asset_id: str) -> list[AssetRecord]:
        """Return [root, ..., asset]. Empty list if the asset is not found."""
        _require_tenant(tenant_id)
        sql = (
            "WITH RECURSIVE anc AS ("
            f"  SELECT {_ASSET_COLS}, 0 AS depth FROM assets WHERE tenant_id = %s AND id = %s"
            "  UNION ALL"
            "  SELECT a.id, a.tenant_id, a.parent_id, a.type, a.name, a.attributes,"
            "         a.created_utc, a.updated_utc, anc.depth + 1"
            "  FROM assets a JOIN anc ON a.id = anc.parent_id WHERE a.tenant_id = %s"
            f") SELECT {_ASSET_COLS} FROM anc ORDER BY depth DESC"
        )
        with self._conn(tenant_id) as conn:
            rows = conn.execute(sql, (tenant_id, asset_id, tenant_id)).fetchall()
        return [_asset_from_row(r) for r in rows]

    # ---- relationships ------------------------------------------------------

    def create_relationship(self, *, tenant_id: str, src_id: str, dst_id: str,
                            relation: str,
                            attributes: dict[str, Any] | None = None) -> AssetRelationshipRecord:
        _require_tenant(tenant_id)
        if not relation:
            raise ValueError("relation must not be empty")
        if src_id == dst_id:
            raise ValueError("src_id and dst_id must differ")
        from psycopg import errors
        from psycopg.types.json import Json

        with self._conn(tenant_id) as conn:
            if not self._exists(conn, src_id):
                raise ValueError(f"src asset {src_id} not found in tenant {tenant_id}")
            if not self._exists(conn, dst_id):
                raise ValueError(f"dst asset {dst_id} not found in tenant {tenant_id}")
            try:
                row = conn.execute(
                    f"INSERT INTO asset_relationships (tenant_id, src_id, dst_id, relation, attributes) "
                    f"VALUES (%s, %s, %s, %s, %s) RETURNING {_REL_COLS}",
                    (tenant_id, src_id, dst_id, relation, Json(dict(attributes or {}))),
                ).fetchone()
            except errors.UniqueViolation as exc:
                raise ValueError("duplicate relationship") from exc
        return _rel_from_row(row)

    def list_relationships(self, *, tenant_id: str, asset_id: str | None = None,
                           relation: str | None = None) -> list[AssetRelationshipRecord]:
        _require_tenant(tenant_id)
        clauses = ["tenant_id = %s"]
        params: list[Any] = [tenant_id]
        if asset_id is not None:
            clauses.append("(src_id = %s OR dst_id = %s)")
            params.extend([asset_id, asset_id])
        if relation is not None:
            clauses.append("relation = %s")
            params.append(relation)
        with self._conn(tenant_id) as conn:
            rows = conn.execute(
                f"SELECT {_REL_COLS} FROM asset_relationships WHERE {' AND '.join(clauses)} "
                f"ORDER BY id",
                params,
            ).fetchall()
        return [_rel_from_row(r) for r in rows]

    # ---- helpers ------------------------------------------------------------

    def _conn(self, tenant_id: str):
        from app.db import pg

        return pg.tenant_connection(tenant_id, dsn=self.dsn, dict_rows=True)

    @staticmethod
    def _exists(conn, asset_id: str) -> bool:
        # tenant scoping comes from RLS (the connection's GUC).
        return conn.execute("SELECT 1 FROM assets WHERE id = %s", (asset_id,)).fetchone() is not None

    @staticmethod
    def _is_ancestor(conn, tenant_id: str, *, ancestor: str, of: str) -> bool:
        """True if ``ancestor`` is ``of`` or appears in ``of``'s parent chain."""
        sql = (
            "WITH RECURSIVE anc AS ("
            "  SELECT id, parent_id FROM assets WHERE tenant_id = %s AND id = %s"
            "  UNION ALL"
            "  SELECT a.id, a.parent_id FROM assets a JOIN anc ON a.id = anc.parent_id"
            "  WHERE a.tenant_id = %s"
            ") SELECT 1 FROM anc WHERE id = %s LIMIT 1"
        )
        return conn.execute(sql, (tenant_id, of, tenant_id, ancestor)).fetchone() is not None


def _iso(value: Any) -> Any:
    return value.isoformat() if value is not None and not isinstance(value, str) else value


def _asset_from_row(row: dict[str, Any]) -> AssetRecord:
    return AssetRecord(
        id=row["id"], tenant_id=row["tenant_id"], parent_id=row.get("parent_id"),
        type=row["type"], name=row["name"],
        attributes=dict(row.get("attributes") or {}),
        created_utc=_iso(row.get("created_utc")) or "",
        updated_utc=_iso(row.get("updated_utc")) or _iso(row.get("created_utc")) or "",
    )


def _rel_from_row(row: dict[str, Any]) -> AssetRelationshipRecord:
    return AssetRelationshipRecord(
        id=row["id"], tenant_id=row["tenant_id"], src_id=row["src_id"],
        dst_id=row["dst_id"], relation=row["relation"],
        attributes=dict(row.get("attributes") or {}),
        created_utc=_iso(row.get("created_utc")) or "",
    )


def get_assets_repository() -> LocalJsonAssetsRepository | PostgresAssetsRepository:
    settings = get_settings()
    if settings.persistence_backend == "local_json":
        return LocalJsonAssetsRepository(
            settings.assets_store_path,
            settings.asset_relationships_store_path,
        )
    if settings.persistence_backend == "postgres":
        return PostgresAssetsRepository(settings.database_url)
    raise ValueError(f"unknown persistence backend {settings.persistence_backend}")


def _require_tenant(tenant_id: str) -> None:
    if not tenant_id:
        raise ValueError("tenant_id is required")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _find(rows: list[dict[str, Any]], *, tenant_id: str, asset_id: str | None) -> dict[str, Any] | None:
    if not asset_id:
        return None
    for row in rows:
        if row["tenant_id"] == tenant_id and row["id"] == asset_id:
            return row
    return None


def _row_to_asset(row: dict[str, Any]) -> AssetRecord:
    return AssetRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        parent_id=row.get("parent_id"),
        type=row["type"],
        name=row["name"],
        attributes=dict(row.get("attributes") or {}),
        created_utc=row.get("created_utc", ""),
        updated_utc=row.get("updated_utc", row.get("created_utc", "")),
    )


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, sort_keys=True) + "\n")
    tmp.replace(path)
