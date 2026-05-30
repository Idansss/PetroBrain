"""
Guardrails - the runtime safety layer from the engineering spec.

Two stages:
  pre  : domain lock, live-event routing, bypass-attempt refusal
  post : numeric-provenance check (numbers must come from a calc tool), citation
         check (cited clauses must exist in retrieved context), safety-banner check

In production the classifiers here are trained models; the regex/keyword versions
below are the deployable Phase-1 baseline and the test scaffold.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.modules.well_control.agent import detect_live_event, IMMEDIATE_ACTION


@dataclass
class GuardrailVerdict:
    allow: bool
    override_response: str | None = None   # if set, return this instead of calling the LLM
    reason: str | None = None
    flags: list[str] | None = None


# Out-of-domain quick filter (the LLM also enforces domain lock; this is defense in depth)
_OFF_DOMAIN_HINTS = [
    r"\bwrite me a poem\b", r"\bmedical advice\b", r"\bwho should i vote\b",
    r"\brecipe\b", r"\bdating\b", r"\bhomework\b",
]

# Attempts to defeat a safety system - hard refuse
_BYPASS_PATTERNS = [
    r"\bbypass (the )?(esd|shutdown|interlock|trip|alarm|gas detector|relief)\b",
    r"\bdisable (the )?(safety|shutdown|interlock|trip|alarm|sis)\b",
    r"\boverride (the )?(trip|interlock|shutdown|sis)\b",
    r"\bforce (the )?valve\b", r"\bdefeat (the )?(interlock|safety)\b",
    r"\binhibit (the )?(alarm|trip|f&g|fire and gas)\b",
]

_BYPASS_REFUSAL = (
    "I can't help with defeating, bypassing, or disabling a safety system, interlock, "
    "trip, alarm, or relief device - doing so removes a layer of protection that exists "
    "to prevent harm. If a safety function genuinely needs to be inhibited for a defined "
    "task, that goes through your Management of Change (MOC) process and an authorized "
    "override/inhibit permit, controlled by the competent authority. I'm glad to explain "
    "how that controlled process works, or why the protection is there."
)


def pre_check(user_text: str) -> GuardrailVerdict:
    t = user_text.lower()
    if any(re.search(p, t) for p in _BYPASS_PATTERNS):
        return GuardrailVerdict(allow=False, override_response=_BYPASS_REFUSAL,
                                reason="bypass_attempt", flags=["safety_bypass"])
    if detect_live_event(user_text):
        # let the answer proceed, but lead with immediate action
        return GuardrailVerdict(allow=True, override_response=IMMEDIATE_ACTION,
                                reason="live_event", flags=["live_event"])
    if any(re.search(p, t) for p in _OFF_DOMAIN_HINTS):
        return GuardrailVerdict(
            allow=False,
            override_response=(
                "I'm built specifically for oil & gas work, so I can't help with that - "
                "but anything across drilling, production, processing, integrity, HSE or "
                "the commercial side, I'm all yours."
            ),
            reason="off_domain", flags=["off_domain"],
        )
    return GuardrailVerdict(allow=True)


def post_check(answer_text: str, *, numbers_from_tools: bool,
               cited_clauses: list[str], retrieved_clauses: list[str],
               safety_critical: bool) -> GuardrailVerdict:
    flags: list[str] = []
    # Numbers presented as results must originate from a calc tool call.
    if re.search(r"\b\d{2,}\s?(psi|ppg|bbl|scf|tonnes?|stb)", answer_text.lower()) and not numbers_from_tools:
        flags.append("unverified_numeric")
    # Cited clauses must exist in retrieved context (no fabricated references).
    fabricated = [c for c in cited_clauses if c not in retrieved_clauses]
    if fabricated:
        flags.append(f"fabricated_citation:{fabricated}")
    # Safety-critical answers must carry a verification reminder.
    if safety_critical and "verify" not in answer_text.lower() and "competent person" not in answer_text.lower():
        flags.append("missing_safety_banner")
    return GuardrailVerdict(allow=not flags, reason="post_check", flags=flags or None)
