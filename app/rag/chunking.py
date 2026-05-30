"""
Structure-aware chunking for technical O&G documents.

Naive fixed-size chunking destroys the thing that makes O&G docs answerable: the
clause/section/step boundaries and the tables. This splitter keeps a standard's
clause as a unit and carries metadata (clause id, revision, jurisdiction) on every
chunk so retrieval can filter and the answer can cite.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

CLAUSE_RE = re.compile(r"^\s*(?:#{1,6}\s*)?((?:\d+\.)+\d+|\d+)\s+", re.MULTILINE)


@dataclass
class Chunk:
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


def chunk_document(text: str, base_meta: dict[str, Any], max_chars: int = 1200) -> list[Chunk]:
    """Split on clause boundaries; fall back to size-bounded paragraphs."""
    chunks: list[Chunk] = []
    # split keeping the clause numbers as anchors
    positions = [m.start() for m in CLAUSE_RE.finditer(text)]
    segments = []
    if positions:
        positions.append(len(text))
        for i in range(len(positions) - 1):
            segments.append(text[positions[i]:positions[i + 1]])
    else:
        segments = [p for p in text.split("\n\n") if p.strip()]

    for seg in segments:
        clause_m = CLAUSE_RE.match(seg)
        clause = clause_m.group(1) if clause_m else None
        # further bound very long clauses
        for piece in _bound(seg, max_chars):
            meta = dict(base_meta)
            if clause:
                meta["clause"] = clause
            chunks.append(Chunk(text=piece.strip(), metadata=meta))
    return [c for c in chunks if c.text]


def _bound(seg: str, max_chars: int) -> list[str]:
    if len(seg) <= max_chars:
        return [seg]
    out, cur = [], ""
    for sentence in re.split(r"(?<=[.;])\s+", seg):
        if len(cur) + len(sentence) > max_chars and cur:
            out.append(cur)
            cur = ""
        cur += sentence + " "
    if cur.strip():
        out.append(cur)
    return out
