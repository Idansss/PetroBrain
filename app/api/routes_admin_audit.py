"""
Admin audit log read API (A6 + B8 cross-tenant override).

GET /admin/audit?tenant_id=&from=&to=&user_id=&module=&action=&limit=&offset=

Tenant-scoped (RLS in production Postgres; in-app filter in the Phase-1
JSONL backend). Role-gated to ``admin`` or ``platform_admin``. Returns
hash-only audit rows so no raw user text or model output ever leaves
the audit store.

B8: platform admins may pass ``?tenant_id=X`` to read another tenant's
events. Anyone else who passes a tenant_id that disagrees with their
principal gets a 403.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import Principal, is_platform_admin, require_role
from app.db.audit_events_repository import get_audit_events_repository


router = APIRouter(prefix="/admin/audit", tags=["admin", "audit"])
_admin_or_platform = require_role("admin", "platform_admin")

MAX_LIMIT = 200
DEFAULT_LIMIT = 50


@router.get("")
async def list_audit_events(
    tenant_id: str | None = Query(default=None),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    user_id: str | None = Query(default=None),
    module: str | None = Query(default=None),
    action: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    who: Principal = Depends(_admin_or_platform),
):
    if from_ is not None and to is not None and from_ > to:
        raise HTTPException(status_code=422, detail="`from` must be <= `to`")
    effective_tenant = _resolve_target_tenant(who, tenant_id)
    rows = _repository().query(
        tenant_id=effective_tenant,
        from_ts=_as_utc(from_),
        to_ts=_as_utc(to),
        user_id=user_id,
        module=module,
        action=action,
        limit=limit,
        offset=offset,
    )
    return {
        "tenant_id": effective_tenant,
        "events": rows,
        "count": len(rows),
        "limit": limit,
        "offset": offset,
    }


def _resolve_target_tenant(principal: Principal, requested: str | None) -> str:
    if requested is None:
        return principal.tenant_id
    if requested != principal.tenant_id and not is_platform_admin(principal):
        raise HTTPException(status_code=403, detail="cross-tenant access denied")
    return requested


def _repository():
    return get_audit_events_repository()


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
