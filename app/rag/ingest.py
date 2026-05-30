"""
Ingestion pipeline: classify -> extract -> chunk -> embed -> index.
Phase-1 wires the text path end-to-end; the P&ID/scanned-OCR extractors plug in at
`extract()` (layout-aware PDF + OCR with engineering post-processing).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from app.rag.chunking import chunk_document
from app.rag.embeddings import Embedder
from app.rag.vectorstore import VectorStore


SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".markdown"}
PDF_PLUG_POINT_MESSAGE = (
    "PDF extraction is a Phase-2 plug-point in this repository. Convert the SOP to "
    "text/Markdown for Phase-1 ingestion, or add a reviewed PDF/OCR extractor in "
    "app/rag/ingest.py with dependency approval."
)


@dataclass(frozen=True)
class DocumentMetadata:
    tenant_id: str
    document_id: str
    title: str
    revision: str = ""
    jurisdiction: str = ""
    asset: str | None = None
    effective_date: date | None = None
    document_type: str = "sop"

    def as_chunk_metadata(self) -> dict[str, Any]:
        if not self.tenant_id:
            raise ValueError("tenant_id is required for ingestion")
        if not self.document_id:
            raise ValueError("document_id is required for ingestion")
        if not self.title:
            raise ValueError("title is required for ingestion")
        return {
            "tenant_id": self.tenant_id,
            "document_id": self.document_id,
            "title": self.title,
            "revision": self.revision,
            "jurisdiction": self.jurisdiction,
            "asset": self.asset,
            "effective_date": self.effective_date.isoformat() if self.effective_date else None,
            "document_type": self.document_type,
        }


def classify_document(path: str | Path) -> str:
    """Classify document by extension; richer type classifiers plug in here later."""
    suffix = Path(path).suffix.lower()
    if suffix in SUPPORTED_TEXT_EXTENSIONS:
        return "text"
    if suffix == ".pdf":
        return "pdf"
    raise ValueError(f"unsupported document extension: {suffix or '[none]'}")


def extract(path: str | Path) -> str:
    """
    Extract text from a supported source file.

    Phase 1 intentionally supports text/Markdown so the ingestion contract, metadata,
    chunking, embedding, and indexing path can be proven without adding OCR/PDF deps.
    """
    source = Path(path)
    kind = classify_document(source)
    if kind == "pdf":
        raise ValueError(PDF_PLUG_POINT_MESSAGE)
    return _read_text_file(source)


def _read_text_file(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(path)
    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("utf-8", b"", 0, 1, f"unable to decode {path}")


async def ingest_text_document(
    store: VectorStore, embedder: Embedder, *, tenant_id: str, document_id: str,
    text: str, title: str, revision: str = "", jurisdiction: str = "",
    asset: str | None = None, effective_date: date | None = None,
) -> int:
    metadata = DocumentMetadata(
        tenant_id=tenant_id, document_id=document_id, title=title, revision=revision,
        jurisdiction=jurisdiction, asset=asset, effective_date=effective_date,
    )
    return await ingest_extracted_text(store, embedder, text=text, metadata=metadata)


async def ingest_document_file(
    store: VectorStore, embedder: Embedder, *, path: str | Path,
    metadata: DocumentMetadata,
) -> int:
    text = extract(path)
    return await ingest_extracted_text(store, embedder, text=text, metadata=metadata)


async def ingest_extracted_text(
    store: VectorStore, embedder: Embedder, *, text: str, metadata: DocumentMetadata,
) -> int:
    if not text.strip():
        raise ValueError("document text is empty")
    base_meta = metadata.as_chunk_metadata()
    chunks = chunk_document(text, base_meta)
    embeddings = await embedder.embed([c.text for c in chunks])
    rows: list[dict[str, Any]] = []
    for c, emb in zip(chunks, embeddings):
        row = dict(c.metadata)
        row["text"] = c.text
        row["embedding"] = emb
        rows.append(row)
    return await store.upsert(rows)
