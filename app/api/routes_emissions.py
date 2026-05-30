from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Principal, get_principal, require_asset_access
from app.core.audit import AuditEvent, get_audit_logger
from app.db.mrv_repository import get_mrv_repository
from app.models.schemas import MRVRequest
from app.modules.emissions_mrv.engine import (
    build_inventory, combustion, flaring, fugitive_tier2, fugitive_tier3, venting,
)
from app.modules.emissions_mrv.ghgemp_template import (
    build_ghgemp_report,
    build_mrv_readiness_summary,
)

router = APIRouter(prefix="/emissions", tags=["emissions_mrv"])
audit_logger = get_audit_logger()
mrv_repository = get_mrv_repository()

_BUILDERS = {
    "flaring": lambda s: flaring(s["source_id"], **s["params"]),
    "venting": lambda s: venting(s["source_id"], **s["params"]),
    "fugitive_t2": lambda s: fugitive_tier2(s["source_id"], **s["params"]),
    "fugitive_t3": lambda s: fugitive_tier3(s["source_id"], **s["params"]),
    "combustion": lambda s: combustion(s["source_id"], **s["params"]),
}


@router.post("/inventory")
async def inventory(req: MRVRequest, who: Principal = Depends(get_principal)):
    require_asset_access(who, req.asset)
    lines = []
    for s in req.sources:
        b = _BUILDERS.get(s.source_type)
        if not b:
            audit_logger.write(AuditEvent(
                event_type="emissions_inventory_error",
                tenant_id=who.tenant_id,
                user_id=who.user_id,
                role=who.role,
                route="/emissions/inventory",
                request=req.model_dump(),
                error={"status_code": 422, "detail": f"unknown source_type {s.source_type}"},
                flags=["validation_error"],
            ))
            raise HTTPException(422, f"unknown source_type {s.source_type}")
        try:
            lines.append(b({"source_id": s.source_id, "params": s.params}))
        except (KeyError, TypeError, ValueError) as exc:
            detail = f"invalid params for {s.source_type} source {s.source_id}: {exc}"
            audit_logger.write(AuditEvent(
                event_type="emissions_inventory_error",
                tenant_id=who.tenant_id,
                user_id=who.user_id,
                role=who.role,
                route="/emissions/inventory",
                request=req.model_dump(),
                error={"status_code": 422, "detail": detail},
                flags=["validation_error"],
            ))
            raise HTTPException(
                status_code=422,
                detail=detail,
            ) from exc
    try:
        inv = build_inventory(req.facility_id, req.period, lines, gwp_set=req.gwp_set)
        report = build_ghgemp_report(inv, operator=req.operator, asset=req.asset,
                                     target_tier=req.target_tier)
    except ValueError as exc:
        audit_logger.write(AuditEvent(
            event_type="emissions_inventory_error",
            tenant_id=who.tenant_id,
            user_id=who.user_id,
            role=who.role,
            route="/emissions/inventory",
            request=req.model_dump(),
            error={"status_code": 422, "detail": str(exc)},
            flags=["validation_error"],
        ))
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    readiness = build_mrv_readiness_summary(report)
    response: dict[str, Any] = {"inventory": inv.as_dict(), "ghgemp_report": report, "mrv_readiness": readiness}
    record = mrv_repository.save(
        tenant_id=who.tenant_id,
        user_id=who.user_id,
        request=req.model_dump(),
        response=response,
    )
    response["inventory_id"] = record.inventory_id
    response["created_utc"] = record.created_utc
    audit_logger.write(AuditEvent(
        event_type="emissions_inventory",
        tenant_id=who.tenant_id,
        user_id=who.user_id,
        role=who.role,
        route="/emissions/inventory",
        request=req.model_dump(),
        response=response,
        flags=[],
        tool_results=[{"tool": "build_inventory", "result": response["inventory"]}],
        metadata={
            "source_count": len(req.sources),
            "tier_summary": response["inventory"]["tier_summary"],
            "audit_sha256": report["audit_sha256"],
            "mrv_status": readiness["status"],
            "gap_count": readiness["gap_count"],
            "inventory_id": record.inventory_id,
        },
    ))
    return response


@router.get("/inventories")
async def list_inventories(who: Principal = Depends(get_principal)):
    return {"inventories": mrv_repository.list_records(tenant_id=who.tenant_id)}


@router.get("/inventories/{inventory_id}")
async def get_inventory(inventory_id: str, who: Principal = Depends(get_principal)):
    record = mrv_repository.get(tenant_id=who.tenant_id, inventory_id=inventory_id)
    if record is None:
        raise HTTPException(status_code=404, detail="inventory not found")
    return record
