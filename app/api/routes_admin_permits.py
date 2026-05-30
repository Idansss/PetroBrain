"""
Permit (PTW) sync endpoint (Tier 4 #6).

The field app flushes its offline outgoing_queue here. POST is open to any
authenticated principal (a field engineer flushing their own permits); the
permit is stored under the principal's tenant + user. GET (review) is
admin/platform only; platform admins may target another tenant with ?tenant_id.
Idempotent on the device-generated permit id.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import Principal, get_principal, is_platform_admin, require_role
from app.core.audit import AuditEvent, get_audit_logger
from app.db.permits_repository import get_permits_repository
from app.models.schemas import PermitUpload

router = APIRouter(prefix="/admin", tags=["permits"])
audit_logger = get_audit_logger()

_reader = require_role("admin", "platform_admin")


@router.post("/permits", status_code=201)
async def submit_permit(req: PermitUpload, who: Principal = Depends(get_principal)):
    record = _repository().upsert(
        tenant_id=who.tenant_id, user_id=who.user_id, permit=req.model_dump()
    )
    audit_logger.write(AuditEvent(
        event_type="permit_sync",
        tenant_id=who.tenant_id,
        user_id=who.user_id,
        role=who.role,
        route="/admin/permits",
        request={"permit_id": req.id, "format": req.format, "status": req.status},
        response={"permit_id": record.id, "status": record.status},
        flags=[],
        metadata={"permit_id": record.id, "status": record.status, "format": record.format},
    ))
    return record.as_dict()


@router.get("/permits")
async def list_permits(
    tenant_id: str | None = Query(default=None),
    who: Principal = Depends(_reader),
):
    target = tenant_id if (tenant_id and is_platform_admin(who)) else who.tenant_id
    return {"permits": _repository().list_records(tenant_id=target)}


def _repository():
    return get_permits_repository()
