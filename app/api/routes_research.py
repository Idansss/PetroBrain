"""Tenant-scoped oil and gas Research Mode API."""
from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from app.api.deps import Principal, require_asset_access, require_role
from app.core.audit import AuditEvent, get_audit_logger
from app.core.audit_hash import sha256_canonical
from app.models.research import (
    ResearchExportRequest,
    ResearchListResponse,
    ResearchPlanDecision,
    ResearchPlanRequest,
    ResearchRunRequest,
    ResearchRunResponse,
)
from app.research.service import ResearchPolicyError, ResearchService


router = APIRouter(prefix="/research", tags=["research"])
research_service = ResearchService()
audit_logger = get_audit_logger()
research_principal = require_role("platform_admin", "admin", "engineer", "hse")


@router.post("/plan", response_model=ResearchRunResponse, status_code=201)
async def create_research_plan(
    req: ResearchPlanRequest,
    who: Principal = Depends(research_principal),
):
    require_asset_access(who, req.asset_context)
    try:
        record = research_service.create_plan(
            request=req,
            tenant_id=who.tenant_id,
            user_id=who.user_id,
            role=who.role,
        )
    except ResearchPolicyError as exc:
        _audit_error("research_plan_refused", "/research/plan", who, req.query, exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _audit(
        event_type="research_plan_created",
        route="/research/plan",
        who=who,
        research_id=record["id"],
        request={"query_hash": sha256_canonical(req.query), "config": _safe_config(record["config"])},
        response={"status": record["status"], "steps": len(record["plan"])},
    )
    return record


@router.post("/{research_id}/approve-plan", response_model=ResearchRunResponse)
async def approve_research_plan(
    research_id: str,
    req: ResearchPlanDecision,
    who: Principal = Depends(research_principal),
):
    try:
        record = research_service.approve_plan(
            tenant_id=who.tenant_id,
            research_id=research_id,
            user_id=who.user_id,
            role=who.role,
            action=req.action,
            plan=[step.model_dump() for step in req.plan] if req.plan is not None else None,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="research run not found") from exc
    except ResearchPolicyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    event_type = (
        "research_plan_approved"
        if req.action == "approve"
        else "research_plan_rejected"
    )
    _audit(
        event_type=event_type,
        route=f"/research/{research_id}/approve-plan",
        who=who,
        research_id=research_id,
        request={"action": req.action, "edited": req.plan is not None},
        response={"status": record["status"]},
    )
    return record


@router.post("/run", response_model=ResearchRunResponse)
async def run_research(
    req: ResearchRunRequest,
    stream: bool = Query(default=False),
    who: Principal = Depends(research_principal),
):
    if stream:
        return StreamingResponse(
            _stream_run(req.research_id, who),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    try:
        async for _ in research_service.run(
            tenant_id=who.tenant_id,
            research_id=req.research_id,
            user_id=who.user_id,
            role=who.role,
        ):
            pass
        record = research_service.get(
            tenant_id=who.tenant_id,
            research_id=req.research_id,
            user_id=who.user_id,
            role=who.role,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="research run not found") from exc
    except ResearchPolicyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    _audit_run(record, who)
    return record


async def _stream_run(research_id: str, who: Principal) -> AsyncIterator[str]:
    try:
        async for item in research_service.run(
            tenant_id=who.tenant_id,
            research_id=research_id,
            user_id=who.user_id,
            role=who.role,
        ):
            yield _sse(item["event"], item["data"])
        record = research_service.get(
            tenant_id=who.tenant_id,
            research_id=research_id,
            user_id=who.user_id,
            role=who.role,
        )
        _audit_run(record, who)
    except KeyError:
        yield _sse("failed", {"code": "not_found", "message": "Research run not found."})
    except ResearchPolicyError as exc:
        yield _sse("failed", {"code": "invalid_state", "message": str(exc)})


@router.get("", response_model=ResearchListResponse)
async def list_research(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    who: Principal = Depends(research_principal),
):
    return {
        "research": research_service.list(
            tenant_id=who.tenant_id,
            user_id=who.user_id,
            role=who.role,
            limit=limit,
            offset=offset,
        )
    }


@router.get("/{research_id}", response_model=ResearchRunResponse)
async def get_research(
    research_id: str,
    who: Principal = Depends(research_principal),
):
    try:
        return research_service.get(
            tenant_id=who.tenant_id,
            research_id=research_id,
            user_id=who.user_id,
            role=who.role,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="research run not found") from exc


@router.get("/{research_id}/events")
async def get_research_events(
    research_id: str,
    after: int = Query(default=0, ge=0),
    who: Principal = Depends(research_principal),
):
    try:
        record = research_service.get(
            tenant_id=who.tenant_id,
            research_id=research_id,
            user_id=who.user_id,
            role=who.role,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="research run not found") from exc
    events = [
        event
        for event in record.get("events") or []
        if int(event.get("sequence") or 0) > after
    ]
    return {"research_id": research_id, "events": events}


@router.post("/{research_id}/stop", response_model=ResearchRunResponse)
async def stop_research(
    research_id: str,
    who: Principal = Depends(research_principal),
):
    try:
        record = research_service.stop(
            tenant_id=who.tenant_id,
            research_id=research_id,
            user_id=who.user_id,
            role=who.role,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="research run not found") from exc
    _audit(
        event_type="research_stopped",
        route=f"/research/{research_id}/stop",
        who=who,
        research_id=research_id,
        request={},
        response={"status": record["status"]},
    )
    return record


@router.delete("/{research_id}", status_code=204)
async def delete_research(
    research_id: str,
    who: Principal = Depends(research_principal),
):
    try:
        deleted = research_service.delete(
            tenant_id=who.tenant_id,
            research_id=research_id,
            user_id=who.user_id,
            role=who.role,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="research run not found") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="research run not found")
    _audit(
        event_type="research_deleted",
        route=f"/research/{research_id}",
        who=who,
        research_id=research_id,
        request={},
        response={"deleted": True},
    )
    return Response(status_code=204)


@router.post("/{research_id}/export")
async def export_research(
    research_id: str,
    req: ResearchExportRequest,
    who: Principal = Depends(research_principal),
):
    try:
        content, media_type, filename = research_service.export(
            tenant_id=who.tenant_id,
            research_id=research_id,
            user_id=who.user_id,
            role=who.role,
            format=req.format,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="research run not found") from exc
    except ResearchPolicyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    _audit(
        event_type="research_exported",
        route=f"/research/{research_id}/export",
        who=who,
        research_id=research_id,
        request={"format": req.format},
        response={"filename": filename},
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, sort_keys=True, default=str)}\n\n"


def _audit_run(record: dict, who: Principal) -> None:
    report = record.get("report") or {}
    _audit(
        event_type="research_run",
        route="/research/run",
        who=who,
        research_id=record["id"],
        request={"query_hash": sha256_canonical(record["query"])},
        response={
            "status": record["status"],
            "source_count": len(record.get("sources") or []),
            "report_hash": sha256_canonical(report.get("markdown") or ""),
        },
        flags=record.get("flags") or [],
    )


def _audit(
    *,
    event_type: str,
    route: str,
    who: Principal,
    research_id: str,
    request: dict,
    response: dict,
    flags: list[str] | None = None,
) -> None:
    audit_logger.write(
        AuditEvent(
            event_type=event_type,
            tenant_id=who.tenant_id,
            user_id=who.user_id,
            role=who.role,
            route=route,
            request=request,
            response=response,
            flags=flags or [],
            metadata={"research_id": research_id},
        )
    )


def _audit_error(
    event_type: str,
    route: str,
    who: Principal,
    query: str,
    exc: ResearchPolicyError,
) -> None:
    audit_logger.write(
        AuditEvent(
            event_type=event_type,
            tenant_id=who.tenant_id,
            user_id=who.user_id,
            role=who.role,
            route=route,
            request={"query_hash": sha256_canonical(query)},
            error={"detail": str(exc)},
            flags=exc.flags,
            metadata={},
        )
    )


def _safe_config(config: dict) -> dict:
    return {
        key: value
        for key, value in config.items()
        if key not in {"query"}
    }
