from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Principal, get_principal
from app.core.audit import AuditEvent, get_audit_logger
from app.models.schemas import KillSheetRequest
from app.modules.well_control.kill_sheet import WellInputs, build_kill_sheet

router = APIRouter(prefix="/well-control", tags=["well_control"])
audit_logger = get_audit_logger()


@router.post("/kill-sheet")
async def kill_sheet(req: KillSheetRequest, who: Principal = Depends(get_principal)):
    data = req.model_dump()
    method = data.pop("method")
    try:
        result = build_kill_sheet(WellInputs(**data), method=method).as_dict()
    except ValueError as exc:
        audit_logger.write(AuditEvent(
            event_type="kill_sheet_error",
            tenant_id=who.tenant_id,
            user_id=who.user_id,
            role=who.role,
            route="/well-control/kill-sheet",
            request=req.model_dump(),
            error={"status_code": 422, "detail": str(exc)},
            flags=["validation_error"],
        ))
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    audit_logger.write(AuditEvent(
        event_type="kill_sheet",
        tenant_id=who.tenant_id,
        user_id=who.user_id,
        role=who.role,
        route="/well-control/kill-sheet",
        request=req.model_dump(),
        response=result,
        flags=[],
        tool_results=[{"tool": "build_kill_sheet", "result": result}],
        metadata={
            "safety_critical": True,
            "method": result["method"],
            "working_steps": len(result["working"]),
        },
    ))
    return result
