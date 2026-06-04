"""
Glossary candidate extraction from per-tenant memories (slice 4 of the
learning loop).

When the same operator term appears in multiple promoted memories - "WHP",
"Bono-1", "Christmas tree" - that's a strong signal it deserves a dedicated
terminology entry. Surfacing these as suggestions lets the admin promote
them with one click rather than re-discovering the pattern by eye.

This module is pure functional logic - takes a list of memory bodies,
returns a ranked list of candidate terms with their occurrence count and
the memory ids that mention them. The admin route filters out terms that
already appear as the body of an active terminology memory.

Heuristics for v1 (conservative; recall > precision is fine here because the
admin reviews every suggestion before it becomes a memory):

  1. Acronyms - sequences of 2-6 uppercase letters with optional digits and
     hyphens at the edges. Matches WHP, SIDPP, MAASP, BOP, OGMP, B8, and
     hyphenated forms like ASSET-A, BONO-1.

  2. Quoted strings - single- or double-quoted spans, often used by admins
     to call out a specific operator name ("we call wellhead pressure 'WHP'").
     Pulls 'WHP' from that example automatically.

Deliberately NOT in scope for v1:
  * Multi-word lowercase noun phrases ("christmas tree") - requires a POS
    tagger to avoid noise, that's a Phase-2 follow-up.
  * Stemming / lemmatisation - "BOP" and "BOPs" stay separate. Conservative.
  * Cross-language - English only for now.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable


# Acronyms: 2-6 uppercase letters with optional digit/hyphen, must start and
# end with a letter or digit. Hyphenated forms (ASSET-A, BONO-1) are common in
# O&G naming so allow them, but only if the whole token is uppercase / digits.
_ACRONYM_RE = re.compile(
    r"\b(?=\w*[A-Z])[A-Z][A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5})?\b"
)

# Single- or double-quoted spans. Group 1 is the quoted body.
_QUOTED_RE = re.compile(r"""['"]([^'"]{2,40})['"]""")

# Strip obvious noise (URLs etc.) before extraction - cheap, optional.
_URL_RE = re.compile(r"https?://\S+")

# Common false-positive acronyms to skip. Two-letter English words and
# pronouns that survive the regex but aren't operator terminology. Lower-case
# for the membership test.
_STOP_ACRONYMS = {
    "id", "is", "it", "in", "on", "an", "to", "of", "by", "or",
    "if", "as", "at", "do", "we", "us", "i", "be", "no",
    "we", "us", "i", "ok", "uk", "us", "eu",
}


@dataclass(frozen=True)
class GlossaryCandidate:
    """One suggested glossary entry.

    ``term`` is the surface form to promote into a memory body. ``count`` is
    the number of distinct source memories that mention it (de-duplicated
    per memory). ``memory_ids`` is the source list so the admin UI can show
    "this term came from these N memories"."""
    term: str
    count: int
    memory_ids: list[str]


def extract_candidates(
    memories: Iterable[dict],
    *,
    min_count: int = 2,
    exclude_terms: Iterable[str] = (),
) -> list[GlossaryCandidate]:
    """Walk the memory bodies, return candidate terms that appear in
    ``min_count`` or more distinct memories. ``exclude_terms`` are
    case-insensitively dropped - the admin route passes already-promoted
    terminology bodies here so suggestions don't loop on themselves.

    Memories without an ``id`` or ``body`` are skipped silently. Returns
    sorted by count desc, then term asc for deterministic output the UI
    can rely on for keys."""
    excluded = {t.strip().lower() for t in exclude_terms if t and isinstance(t, str)}
    # term -> set of memory_ids that mention it (set so a memory that says the
    # same term twice doesn't inflate count).
    occurrences: dict[str, set[str]] = {}

    for mem in memories or []:
        body = mem.get("body") if isinstance(mem, dict) else None
        memory_id = mem.get("id") if isinstance(mem, dict) else None
        if not isinstance(body, str) or not isinstance(memory_id, str):
            continue
        cleaned = _URL_RE.sub(" ", body)
        for term in _terms_in(cleaned):
            normalized = term.strip()
            if not normalized:
                continue
            if normalized.lower() in excluded:
                continue
            occurrences.setdefault(normalized, set()).add(memory_id)

    out: list[GlossaryCandidate] = []
    for term, ids in occurrences.items():
        if len(ids) >= min_count:
            out.append(GlossaryCandidate(
                term=term, count=len(ids),
                memory_ids=sorted(ids),
            ))
    out.sort(key=lambda c: (-c.count, c.term))
    return out


def _terms_in(text: str) -> list[str]:
    """Yield every candidate term found in ``text``. Acronyms first
    (typically more interesting), then quoted strings."""
    terms: list[str] = []
    for m in _ACRONYM_RE.finditer(text):
        token = m.group(0)
        if token.lower() in _STOP_ACRONYMS:
            continue
        terms.append(token)
    for m in _QUOTED_RE.finditer(text):
        body = m.group(1).strip()
        if 2 <= len(body) <= 40:
            terms.append(body)
    return terms
