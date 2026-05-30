"""
Text extractors for the async ingestion worker.

Phase-1 contract: ``extract_text`` takes raw bytes + filename, returns plain
text. PDFs go through ``pdfplumber``; .docx through ``python-docx``; plain
.txt/.md/.markdown are decoded directly. Anything else raises so the worker
fails the ingest with a clear reason instead of indexing garbage.
"""
from __future__ import annotations

import io
from pathlib import Path


SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".markdown"}
SUPPORTED_PDF_EXTENSIONS = {".pdf"}
SUPPORTED_DOCX_EXTENSIONS = {".docx"}


def supported_extension(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in (
        SUPPORTED_TEXT_EXTENSIONS | SUPPORTED_PDF_EXTENSIONS | SUPPORTED_DOCX_EXTENSIONS
    )


def extract_text(raw: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in SUPPORTED_TEXT_EXTENSIONS:
        return _decode(raw)
    if ext in SUPPORTED_PDF_EXTENSIONS:
        return _extract_pdf(raw)
    if ext in SUPPORTED_DOCX_EXTENSIONS:
        return _extract_docx(raw)
    raise ValueError(f"unsupported document extension: {ext or '[none]'}")


def _decode(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _extract_pdf(raw: bytes) -> str:
    import pdfplumber  # lazy: only required when a PDF arrives

    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text)
    return "\n\n".join(parts)


def _extract_docx(raw: bytes) -> str:
    import docx  # python-docx; lazy import for the same reason

    document = docx.Document(io.BytesIO(raw))
    return "\n".join(p.text for p in document.paragraphs if p.text is not None)
