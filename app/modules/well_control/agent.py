"""
Well Control specialist agent.

Demonstrates the module pattern from the engineering spec:
  base system prompt  +  module preamble  +  module tools (the kill-sheet engine)

It also enforces the safety routing rule from the system prompt: if the user
appears to be in a LIVE well-control event, immediate-action guidance comes FIRST,
before any calculation.
"""
from __future__ import annotations

import re
from typing import Any

from .kill_sheet import WellInputs, build_kill_sheet

MODULE_PREAMBLE = """\
<module>Well Control</module>
You are operating as PetroBrain's Well Control specialist. You assist with kick
detection theory, shut-in procedures, kill-sheet construction (Driller's and
Wait-and-Weight), influx identification, and well-control calculations.

Hard rules for this module, in addition to the base safety principles:
- You are decision SUPPORT. The Well Site Leader / competent person and the rig's
  well-control procedure have authority, not you.
- Kill-sheet numbers come ONLY from the kill_sheet tool, never from your own
  arithmetic. Present the tool's working; do not recompute in prose.
- Always carry the verification banner on any kill-sheet output.
- Confirm the unit system and whether depths are TVD or MD before computing; a
  TVD/MD or ppg/sg error here is a safety event.
- If the user indicates a live, unfolding event, give immediate-action guidance
  first and keep it short.
"""

# crude live-event detector; in production this is a trained classifier (see guardrails)
_LIVE_EVENT_PATTERNS = [
    r"\btaking a kick\b", r"\bwe('| a)?re kicking\b", r"\bgas alarm\b",
    r"\bwell is flowing\b", r"\bflow check positive\b", r"\bpit gain(ing)?\b.*\bnow\b",
    r"\bunloading\b", r"\bwell control (event|situation|now)\b", r"\bh2s alarm\b",
]

IMMEDIATE_ACTION = (
    "IMMEDIATE ACTION FIRST - if this is happening now:\n"
    "1. Alert the driller / Well Site Leader and the control room immediately.\n"
    "2. Follow your rig's well-control shut-in procedure (space out, shut in per "
    "your hard/soft shut-in policy).\n"
    "3. Record SIDPP, SICP and pit gain once shut in and stabilized.\n"
    "4. Do not rely on this assistant for the response - it supports, it does not "
    "command. Engage the competent person now.\n\n"
    "Once shut in and stabilized, I can build the kill sheet from your recorded "
    "SIDPP, SICP, pit gain, SCR pressure and hole/string data."
)


def detect_live_event(user_text: str) -> bool:
    t = user_text.lower()
    return any(re.search(p, t) for p in _LIVE_EVENT_PATTERNS)


# Tool schema the orchestrator/LLM sees for function-calling
KILL_SHEET_TOOL = {
    "name": "build_kill_sheet",
    "description": (
        "Build a well-control kill sheet (Driller's or Wait-and-Weight). "
        "Requires shut-in pressures, hole/string volumes and slow-circulating-rate "
        "pressure. Returns KMW, ICP, FCP, strokes, a DPP pressure schedule, influx "
        "analysis and MAASP. SAFETY-CRITICAL: decision support only."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "tvd_ft": {"type": "number"},
            "md_ft": {"type": "number"},
            "omw_ppg": {"type": "number"},
            "sidpp_psi": {"type": "number"},
            "sicp_psi": {"type": "number"},
            "pit_gain_bbl": {"type": "number"},
            "scr_pressure_psi": {"type": "number"},
            "pump_output_bbl_per_stk": {"type": "number"},
            "drill_string_volume_bbl": {"type": "number"},
            "annulus_volume_bit_to_surface_bbl": {"type": "number"},
            "annular_capacity_bbl_per_ft": {"type": "number"},
            "shoe_tvd_ft": {"type": "number"},
            "max_allowable_mw_ppg": {"type": "number"},
            "method": {"type": "string", "enum": ["wait_and_weight", "drillers"]},
        },
        "required": [
            "tvd_ft", "md_ft", "omw_ppg", "sidpp_psi", "sicp_psi", "pit_gain_bbl",
            "scr_pressure_psi", "pump_output_bbl_per_stk", "drill_string_volume_bbl",
            "annulus_volume_bit_to_surface_bbl", "annular_capacity_bbl_per_ft",
        ],
    },
}


def run_kill_sheet_tool(args: dict[str, Any]) -> dict[str, Any]:
    """Deterministic tool entrypoint the orchestrator calls when the LLM requests it."""
    method = args.pop("method", "wait_and_weight")
    w = WellInputs(**args)
    return build_kill_sheet(w, method=method).as_dict()
