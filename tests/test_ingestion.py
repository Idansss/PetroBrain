"""
RAG ingestion tests.

These run without Postgres or hosted embeddings by using small fakes. The point is to
lock down the citation-grade ingestion contract: tenant, document, revision, clause,
jurisdiction, asset, effective date, text, and embedding all travel together.
"""
import os
import sys
import asyncio
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app.rag.chunking import chunk_document
from app.rag.ingest import (
    PDF_PLUG_POINT_MESSAGE,
    DocumentMetadata,
    classify_document,
    extract,
    ingest_document_file,
    ingest_extracted_text,
)


class FakeEmbedder:
    async def embed(self, texts):
        return [[float(i), float(len(text))] for i, text in enumerate(texts)]


class MemoryStore:
    def __init__(self):
        self.rows = []

    async def upsert(self, rows):
        self.rows.extend(rows)
        return len(rows)


def metadata():
    return DocumentMetadata(
        tenant_id="tenant-a",
        document_id="sop-001",
        title="Kick Detection SOP",
        revision="Rev 2",
        jurisdiction="Nigeria",
        asset="Rig-7",
        effective_date=date(2026, 5, 1),
    )


def test_classify_document_extensions():
    assert classify_document("procedure.txt") == "text"
    assert classify_document("procedure.md") == "text"
    assert classify_document("procedure.pdf") == "pdf"
    with pytest.raises(ValueError, match="unsupported document extension"):
        classify_document("procedure.docx")


def test_extract_reads_text_and_rejects_pdf_plug_point(tmp_path):
    source = tmp_path / "sop.md"
    source.write_text("# 1 Purpose\nDetect kicks early.", encoding="utf-8")
    assert "Detect kicks" in extract(source)

    pdf = tmp_path / "sop.pdf"
    pdf.write_bytes(b"%PDF-1.7")
    with pytest.raises(ValueError, match="PDF extraction is a Phase-2 plug-point"):
        extract(pdf)
    assert "dependency approval" in PDF_PLUG_POINT_MESSAGE


def test_chunk_document_preserves_markdown_clause_metadata():
    chunks = chunk_document("# 1 Purpose\nText.\n\n## 2.1 Shut-in\nFollow procedure.", metadata().as_chunk_metadata())
    clauses = [c.metadata.get("clause") for c in chunks]
    assert clauses == ["1", "2.1"]


def test_ingest_extracted_text_writes_citation_grade_rows():
    store = MemoryStore()
    count = asyncio.run(
        ingest_extracted_text(
            store,
            FakeEmbedder(),
            text="# 1 Purpose\nDetect kicks early.\n\n## 2.1 Shut-in\nFollow procedure.",
            metadata=metadata(),
        )
    )

    assert count == 2
    first = store.rows[0]
    assert first["tenant_id"] == "tenant-a"
    assert first["document_id"] == "sop-001"
    assert first["title"] == "Kick Detection SOP"
    assert first["revision"] == "Rev 2"
    assert first["jurisdiction"] == "Nigeria"
    assert first["asset"] == "Rig-7"
    assert first["effective_date"] == "2026-05-01"
    assert first["clause"] == "1"
    assert first["text"].startswith("# 1 Purpose")
    assert first["embedding"] == [0.0, float(len(first["text"]))]


def test_ingest_document_file_reads_file_and_indexes_rows(tmp_path):
    source = tmp_path / "kick-detection.md"
    source.write_text("# 1 Scope\nRig floor kick detection checks.", encoding="utf-8")
    store = MemoryStore()

    count = asyncio.run(ingest_document_file(store, FakeEmbedder(), path=source, metadata=metadata()))

    assert count == 1
    assert store.rows[0]["clause"] == "1"
    assert "Rig floor" in store.rows[0]["text"]


def test_ingestion_requires_tenant_id():
    store = MemoryStore()
    bad_meta = DocumentMetadata(tenant_id="", document_id="sop-001", title="SOP")

    with pytest.raises(ValueError, match="tenant_id is required"):
        asyncio.run(ingest_extracted_text(store, FakeEmbedder(), text="1 Scope\nText", metadata=bad_meta))


def test_ingestion_rejects_empty_text():
    store = MemoryStore()
    with pytest.raises(ValueError, match="document text is empty"):
        asyncio.run(ingest_extracted_text(store, FakeEmbedder(), text="   ", metadata=metadata()))
