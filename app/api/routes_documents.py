from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import Principal, get_principal, require_asset_access
from app.core.audit import AuditEvent, get_audit_logger
from app.db.document_repository import get_document_repository
from app.models.schemas import DocumentIngestRequest
from app.rag.chunking import chunk_document
from app.rag.ingest import DocumentMetadata, PDF_PLUG_POINT_MESSAGE, classify_document

router = APIRouter(prefix="/documents", tags=["documents"])
# /docs/* is the field app's offline-sync contract (distinct from /documents/*).
docs_router = APIRouter(prefix="/docs", tags=["documents"])
audit_logger = get_audit_logger()
document_repository = get_document_repository()


@docs_router.get("/snapshot")
async def docs_snapshot(
    since: str | None = Query(default=None),
    who: Principal = Depends(get_principal),
):
    """Tenant-scoped incremental SOP snapshot for the field offline cache.
    Returns full documents (with chunks) created after ``since`` (ISO-8601),
    oldest first, plus ``as_of`` to use as the next ``since``."""
    docs = get_document_repository().snapshot(tenant_id=who.tenant_id, since=since)
    as_of = docs[-1]["created_utc"] if docs else (since or "")
    return {"documents": docs, "as_of": as_of, "count": len(docs)}


@router.post("/preview")
async def preview_document(req: DocumentIngestRequest, who: Principal = Depends(get_principal)):
    try:
        require_asset_access(who, req.asset)
        chunks = _chunks_from_request(req, who)
    except HTTPException as exc:
        _audit_document_error("document_preview_error", "/documents/preview", req, who, exc)
        raise
    audit_logger.write(AuditEvent(
        event_type="document_preview",
        tenant_id=who.tenant_id,
        user_id=who.user_id,
        role=who.role,
        route="/documents/preview",
        request=_request_without_text(req),
        response={"chunk_count": len(chunks)},
        flags=[],
        metadata={
            "document_id": req.document_id,
            "title": req.title,
            "revision": req.revision,
            "asset": req.asset,
            "chunk_count": len(chunks),
        },
    ))
    return {"chunk_count": len(chunks), "chunks": chunks}


@router.post("/ingest")
async def ingest_document(req: DocumentIngestRequest, who: Principal = Depends(get_principal)):
    try:
        require_asset_access(who, req.asset)
        chunks = _chunks_from_request(req, who)
    except HTTPException as exc:
        _audit_document_error("document_ingest_error", "/documents/ingest", req, who, exc)
        raise
    request_data = req.model_dump(mode="json")
    record = document_repository.save(
        tenant_id=who.tenant_id,
        user_id=who.user_id,
        request=request_data,
        chunks=chunks,
    )
    audit_logger.write(AuditEvent(
        event_type="document_ingest",
        tenant_id=who.tenant_id,
        user_id=who.user_id,
        role=who.role,
        route="/documents/ingest",
        request={k: v for k, v in request_data.items() if k != "text"},
        response={"ingest_id": record.ingest_id, "chunk_count": record.chunk_count},
        flags=[],
        metadata={
            "document_id": req.document_id,
            "title": req.title,
            "revision": req.revision,
            "asset": req.asset,
            "chunk_count": record.chunk_count,
        },
    ))
    return record.as_dict()


@router.get("")
async def list_documents(who: Principal = Depends(get_principal)):
    return {"documents": document_repository.list_records(tenant_id=who.tenant_id)}


@router.get("/{ingest_id}")
async def get_document(ingest_id: str, who: Principal = Depends(get_principal)):
    record = document_repository.get(tenant_id=who.tenant_id, ingest_id=ingest_id)
    if record is None:
        raise HTTPException(status_code=404, detail="document ingest not found")
    return record


def _chunks_from_request(req: DocumentIngestRequest, who: Principal) -> list[dict]:
    try:
        kind = classify_document(req.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if kind == "pdf":
        raise HTTPException(status_code=422, detail=PDF_PLUG_POINT_MESSAGE)
    metadata = DocumentMetadata(
        tenant_id=who.tenant_id,
        document_id=req.document_id,
        title=req.title,
        revision=req.revision,
        jurisdiction=req.jurisdiction,
        asset=req.asset,
        effective_date=req.effective_date,
        document_type=req.document_type,
    )
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="document text is empty")
    chunks = chunk_document(req.text, metadata.as_chunk_metadata())
    return [
        {
            "chunk_index": i,
            "text": chunk.text,
            "clause": chunk.metadata.get("clause"),
            "metadata": chunk.metadata,
        }
        for i, chunk in enumerate(chunks)
    ]


def _request_without_text(req: DocumentIngestRequest) -> dict:
    return {k: v for k, v in req.model_dump(mode="json").items() if k != "text"}


def _audit_document_error(
    event_type: str,
    route: str,
    req: DocumentIngestRequest,
    who: Principal,
    exc: HTTPException,
) -> None:
    audit_logger.write(AuditEvent(
        event_type=event_type,
        tenant_id=who.tenant_id,
        user_id=who.user_id,
        role=who.role,
        route=route,
        request=_request_without_text(req),
        error={"status_code": exc.status_code, "detail": exc.detail},
        flags=["validation_error"] if exc.status_code == 422 else ["authorization_error"],
        metadata={
            "document_id": req.document_id,
            "title": req.title,
            "revision": req.revision,
            "asset": req.asset,
        },
    ))
