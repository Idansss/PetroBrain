"""Chat attachments of kind=document carrying base64 bytes get extracted
in-process and inlined into the user turn so the model can answer questions
about a PDF/DOCX without a full ingest cycle."""
from __future__ import annotations

import base64

from app.core.orchestrator import _build_user_message_content


def _att(kind: str, name: str, data: str | None, mime: str = "application/octet-stream"):
    return {"kind": kind, "name": name, "data": data, "mime_type": mime}


def test_text_kind_inlines_directly():
    content = _build_user_message_content(
        "summarise this",
        [_att("text", "notes.md", "# Kick procedure\nshut in the well", "text/markdown")],
    )
    assert "# Kick procedure" in content


def test_document_kind_with_no_data_falls_through_to_note():
    content = _build_user_message_content(
        "what's in here?",
        [_att("document", "ops.pdf", None, "application/pdf")],
    )
    assert "ingest via the Documents tab" in content


def test_document_kind_with_pdf_bytes_inlines_extracted_text(tmp_path):
    """Build a tiny PDF on disk, base64-encode its bytes, hand it to the
    orchestrator, and expect the extracted text to appear in the user turn."""
    try:
        import pdfplumber  # noqa: F401
        from reportlab.pdfgen import canvas  # type: ignore
    except ImportError:
        import pytest
        pytest.skip("reportlab/pdfplumber not installed; PDF inline path is best-effort")

    pdf_path = tmp_path / "ops.pdf"
    c = canvas.Canvas(str(pdf_path))
    c.drawString(100, 750, "Kick warning: SIDPP 1200 psi.")
    c.showPage()
    c.save()
    pdf_bytes = pdf_path.read_bytes()
    payload = base64.b64encode(pdf_bytes).decode("ascii")

    content = _build_user_message_content(
        "what's the SIDPP?",
        [_att("document", "ops.pdf", payload, "application/pdf")],
    )
    assert "ops.pdf (extracted)" in content
    assert "SIDPP 1200 psi" in content


def test_document_kind_with_unsupported_extension_falls_back_to_note():
    payload = base64.b64encode(b"\x00\x01\x02").decode("ascii")
    content = _build_user_message_content(
        "tell me about it",
        [_att("document", "blob.xyz", payload, "application/octet-stream")],
    )
    assert "ingest via the Documents tab" in content


def test_document_kind_with_corrupt_base64_falls_back_to_note():
    content = _build_user_message_content(
        "tell me about it",
        [_att("document", "ops.pdf", "not-base64-at-all-!!!", "application/pdf")],
    )
    # Either it could not extract (note) or returned empty - both go to the
    # "could not extract text" or generic note branch.
    assert "ops.pdf" in content
    assert "tab" in content.lower()
