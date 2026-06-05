"""Web search fallback snippet scrubbing.

When the model produces no prose after a web_search tool call, the
orchestrator builds a bullet summary from the returned snippets. Crawlers
occasionally pull inline SVG sprites and HTML attributes into those
snippets - the result was unreadable URL-encoded garbage like
``'/%3E%3Cpath d='M16.0001 7.9996c0 4.418-3.5815...'`` leaking into the
user-facing answer. These tests lock in the scrubber so that regression
doesn't return.
"""
from __future__ import annotations

from app.core.orchestrator import (
    _clean_summary_part,
    _fallback_answer_from_web_results,
    _strip_markup_fragments,
)


# ---- the scrubber on its own ------------------------------------------

def test_url_encoded_svg_fragment_is_stripped():
    """Reproduces the exact garbage from the bug report screenshot."""
    raw = (
        "'/%3E%3Cpath d='M16.0001 7.9996c0 4.418-3.5815 7.9996-7.9995 "
        "7.9996S.001 12.4176.001 7.9996Z' "
        "fill='url(%23paint1radial1525163610)'/%3E%3Cpath"
    )
    out = _strip_markup_fragments(raw)
    # Markup signatures all gone.
    assert "%3C" not in out
    assert "%3E" not in out
    assert "<path" not in out
    assert "d='M" not in out
    assert "fill=" not in out


def test_full_html_tag_stripped():
    out = _strip_markup_fragments(
        "Bono <svg xmlns='http://www.w3.org/2000/svg'><path d='M0 0L16 16Z'/></svg> Energy"
    )
    assert "<svg" not in out
    assert "<path" not in out
    assert "Bono" in out
    assert "Energy" in out


def test_plain_prose_with_no_markup_passes_through():
    """The scrubber must NOT mangle a normal snippet. The cheap signal
    check should short-circuit before any substitutions run."""
    raw = "Bono Energy was founded in 2004 and operates in Nigeria."
    assert _strip_markup_fragments(raw) == raw


def test_plain_url_with_percent20_is_left_alone():
    """Only markup-relevant url-encoded codepoints (%3C / %3E / %23) trip
    the scrubber. Real URLs with %20 etc. survive intact."""
    raw = "See https://example.com/path%20with%20spaces.html for details"
    assert _strip_markup_fragments(raw) == raw


# ---- the scrubber via _clean_summary_part ------------------------------

def test_clean_summary_part_strips_svg_garbage_end_to_end():
    raw = (
        "Bono Energy '/%3E%3Cpath d='M16.0001 7.9996c0 4.418Z' "
        "fill='url(%23paint1)'/%3E announces leadership"
    )
    out = _clean_summary_part(raw)
    assert "<" not in out
    assert "%3C" not in out
    assert "%3E" not in out
    assert "d='M" not in out
    assert "Bono Energy" in out
    assert "announces leadership" in out


# ---- end-to-end: the fallback builder hands the user clean text -------

def test_fallback_answer_from_web_results_scrubs_snippets():
    tool_results = [{
        "tool": "web_search",
        "result": {
            "results": [
                {
                    "title": "Bono Energy",
                    "snippet": (
                        "From the Right: Kola Kelani... - Odetayo Victor "
                        "'/%3E%3Cpath d='M16.0001 7.9996c0 4.418Z' "
                        "fill='url(%23paint1radial1525163610)'/%3E%3Cpath"
                    ),
                },
            ],
        },
    }]
    answer = _fallback_answer_from_web_results(tool_results)
    assert "%3C" not in answer
    assert "%3E" not in answer
    assert "<path" not in answer
    assert "d='M" not in answer
    # And the readable prose still made it through.
    assert "Kola Kelani" in answer
    assert "Odetayo Victor" in answer
