"""
Prompt assembly. Loads the versioned base system prompt and composes it with a
module preamble and the runtime context, per the engineering-spec pattern:

    base prompt  +  module preamble  +  runtime context (role, jurisdiction, asset,
                                                          retrieved context)

The base prompt lives in petrobrain_system_prompt.md (shipped alongside the repo);
in production it is a versioned asset loaded at startup and hashed for the audit log.
"""
from __future__ import annotations

from app.modules.ptw.agent import MODULE_PREAMBLE as PTW_PREAMBLE
from app.modules.well_control.agent import MODULE_PREAMBLE as WELL_CONTROL_PREAMBLE

# In production, read the .md file; inlined fallback keeps the module self-contained.
BASE_SYSTEM_PROMPT = """\
You are PetroBrain, a specialist AI for the oil & gas industry (upstream, midstream,
downstream) serving field and office staff. You answer oil & gas questions only and
decline everything else briefly. You are decision SUPPORT, never a decision-maker for
safety-critical operations; you never help bypass a safety system; on a live safety
event you direct the user to immediate human action first. Calculations come only from
the calculation tools, shown with formula, inputs, steps, result and unit sanity-check;
flag unit ambiguity (ppg/sg, psi/bar) as a safety issue. Ground answers in retrieved
context and cite document + revision + clause; never fabricate a clause number,
threshold, or spec - say you don't have it. Distinguish 'general practice' vs 'your SOP'
vs 'the regulation'. Express calibrated uncertainty. Be concise for field users, rigorous
for engineers, decision-first for management.
"""

MODULE_PREAMBLES = {
    "well_control": WELL_CONTROL_PREAMBLE,
    "emissions_mrv": (
        "<module>Emissions / MRV</module>\n"
        "You assist with NUPRC methane & GHG MRV: building source inventories, "
        "Tier 2 (factor-based) and Tier 3 (measurement-based) quantification, CO2e with "
        "the stated IPCC GWP set, and GHGEMP report generation. All emission numbers come "
        "from the emissions engine tools. Always state the GWP set and factor source, and "
        "flag any source not yet on measurement-based Tier 3 against the Jan-2027 deadline."
    ),
    "ptw": PTW_PREAMBLE,
    "general": "",
}


def build_system_prompt(
    module: str = "general",
    *,
    user_role: str | None = None,
    jurisdiction: str | None = None,
    asset_context: str | None = None,
    retrieved_context: str | None = None,
    offline_mode: bool = False,
) -> str:
    parts = [BASE_SYSTEM_PROMPT, MODULE_PREAMBLES.get(module, "")]
    ctx = []
    if user_role:
        ctx.append(f"user_role: {user_role}")
    if jurisdiction:
        ctx.append(f"jurisdiction: {jurisdiction}")
    if asset_context:
        ctx.append(f"asset_context: {asset_context}")
    if offline_mode:
        ctx.append("offline_mode: true (only on-device cache available)")
    if ctx:
        parts.append("<runtime_context>\n" + "\n".join(ctx) + "\n</runtime_context>")
    if retrieved_context:
        parts.append("<retrieved_context>\n" + retrieved_context + "\n</retrieved_context>")
    return "\n\n".join(p for p in parts if p.strip())
