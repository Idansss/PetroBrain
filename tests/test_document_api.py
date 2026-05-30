"""Document ingestion API tests."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from app.api import deps, routes_documents
from app.db.document_repository import LocalJsonDocumentRepository
from app.main import app
from tests.auth_helpers import auth_headers, jwt_settings


client = TestClient(app)


@pytest.fixture(autouse=True)
def use_jwt_settings(monkeypatch):
    monkeypatch.setattr(deps, "get_settings", jwt_settings)


def tenant_a_headers():
    return auth_headers(tenant_id="tenant-a", user_id="alice", allowed_assets=["Asset-A"])


def tenant_b_headers():
    return auth_headers(tenant_id="tenant-b", user_id="bob", allowed_assets=["Asset-B"])


def document_payload(asset="Asset-A", filename="kick.md", text=None):
    return {
        "filename": filename,
        "document_id": "SOP-KICK-001",
        "title": "Kick Detection SOP",
        "revision": "Rev 1",
        "jurisdiction": "Nigeria",
        "asset": asset,
        "effective_date": "2026-05-28",
        "document_type": "sop",
        "text": text if text is not None else (
            "# 1 Purpose\n"
            "Detect kicks early and route live well-control events to the competent person.\n\n"
            "## 2.1 Flow check\n"
            "If the flow check is positive, follow the rig shut-in procedure and record SIDPP, SICP and pit gain.\n"
        ),
    }


def test_document_preview_chunks_markdown_clauses():
    r = client.post("/documents/preview", headers=auth_headers(), json=document_payload(asset="demo asset"))

    assert r.status_code == 200
    body = r.json()
    assert body["chunk_count"] == 2
    assert body["chunks"][0]["clause"] == "1"
    assert body["chunks"][1]["clause"] == "2.1"
    assert body["chunks"][0]["metadata"]["tenant_id"] == "demo"
    assert body["chunks"][0]["metadata"]["document_id"] == "SOP-KICK-001"


def test_document_ingest_save_list_get_by_tenant(monkeypatch, tmp_path):
    monkeypatch.setattr(
        routes_documents,
        "document_repository",
        LocalJsonDocumentRepository(tmp_path / "documents.jsonl"),
    )

    created = client.post(
        "/documents/ingest",
        headers=tenant_a_headers(),
        json=document_payload(asset="Asset-A"),
    )
    assert created.status_code == 200
    body = created.json()
    ingest_id = body["ingest_id"]
    assert body["tenant_id"] == "tenant-a"
    assert body["chunk_count"] == 2

    own_list = client.get("/documents", headers=tenant_a_headers())
    assert own_list.status_code == 200
    assert len(own_list.json()["documents"]) == 1
    assert own_list.json()["documents"][0]["ingest_id"] == ingest_id

    other_list = client.get("/documents", headers=tenant_b_headers())
    assert other_list.status_code == 200
    assert other_list.json()["documents"] == []

    other_detail = client.get(f"/documents/{ingest_id}", headers=tenant_b_headers())
    assert other_detail.status_code == 404

    own_detail = client.get(f"/documents/{ingest_id}", headers=tenant_a_headers())
    assert own_detail.status_code == 200
    assert own_detail.json()["chunks"][1]["metadata"]["clause"] == "2.1"


def test_document_ingest_requires_asset_scope(monkeypatch, tmp_path):
    monkeypatch.setattr(
        routes_documents,
        "document_repository",
        LocalJsonDocumentRepository(tmp_path / "documents.jsonl"),
    )

    r = client.post(
        "/documents/ingest",
        headers=tenant_a_headers(),
        json=document_payload(asset="Asset-B"),
    )

    assert r.status_code == 403
    assert r.json()["detail"] == "asset not allowed for principal"


def test_document_preview_blocks_pdf_plug_point():
    r = client.post(
        "/documents/preview",
        headers=auth_headers(),
        json=document_payload(asset="demo asset", filename="kick.pdf"),
    )

    assert r.status_code == 422
    assert "PDF extraction is a Phase-2 plug-point" in r.json()["detail"]


def test_document_preview_rejects_empty_text():
    r = client.post(
        "/documents/preview",
        headers=auth_headers(),
        json=document_payload(asset="demo asset", text="   "),
    )

    assert r.status_code == 422
    assert r.json()["detail"] == "document text is empty"
