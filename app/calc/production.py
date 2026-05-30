"""
Production engineering calculations: inflow performance and decline.
Kept deliberately small for Phase 1 - extend the library, don't put math in the LLM.
"""
from __future__ import annotations

import math

from .drilling import CalcResult


def vogel_ipr(q_test_stbd: float, pwf_test_psi: float, pr_psi: float) -> CalcResult:
    """
    Vogel IPR for a saturated (solution-gas-drive) oil well.
    First back out qo_max from the test point, then the curve is:
        qo/qo_max = 1 - 0.2(Pwf/Pr) - 0.8(Pwf/Pr)^2
    """
    ratio = pwf_test_psi / pr_psi
    denom = 1 - 0.2 * ratio - 0.8 * ratio**2
    qo_max = q_test_stbd / denom
    notes = []
    if pwf_test_psi > pr_psi:
        notes.append("Pwf > Pr is non-physical for production - check inputs.")
    return CalcResult(
        name="Vogel IPR (qo_max)",
        formula="qo/qo_max = 1 - 0.2(Pwf/Pr) - 0.8(Pwf/Pr)^2",
        inputs={"q_test_stbd": q_test_stbd, "pwf_test_psi": pwf_test_psi, "pr_psi": pr_psi},
        result=qo_max,
        unit="STB/d",
        steps=[
            f"Pwf/Pr = {ratio:.4f}",
            f"denominator = 1 - 0.2*{ratio:.4f} - 0.8*{ratio:.4f}^2 = {denom:.4f}",
            f"qo_max = {q_test_stbd} / {denom:.4f} = {qo_max:.1f} STB/d",
        ],
        notes=notes,
    )


def arps_exponential_rate(qi_stbd: float, decline_per_year: float, t_years: float) -> CalcResult:
    """Arps exponential decline: q(t) = qi * exp(-D t)."""
    q = qi_stbd * math.exp(-decline_per_year * t_years)
    notes = _decline_notes(qi_stbd, decline_per_year, t_years)
    return CalcResult(
        name="Arps Exponential Decline Rate",
        formula="q(t) = qi * exp(-D * t)",
        inputs={"qi_stbd": qi_stbd, "decline_per_year": decline_per_year, "t_years": t_years},
        result=q,
        unit="STB/d",
        steps=[f"q = {qi_stbd} * exp(-{decline_per_year} * {t_years}) = {q:.1f} STB/d"],
        notes=notes,
    )


def arps_exponential_cumulative(qi_stbd: float, decline_per_year: float,
                                t_years: float) -> CalcResult:
    """
    Arps exponential cumulative oil production.

    Np = (qi / D) * (1 - exp(-D t)) in rate-time units; convert years to days for
    STB/d rates so the result is stock-tank barrels.
    """
    notes = _decline_notes(qi_stbd, decline_per_year, t_years)
    if decline_per_year == 0:
        np_stb = qi_stbd * t_years * 365.25
        steps = [f"D = 0, so Np = qi * t = {qi_stbd} * {t_years} * 365.25 = {np_stb:.1f} STB"]
    else:
        rate_time = qi_stbd / decline_per_year * (1 - math.exp(-decline_per_year * t_years))
        np_stb = rate_time * 365.25
        steps = [
            f"exp(-D*t) = exp(-{decline_per_year} * {t_years}) = "
            f"{math.exp(-decline_per_year * t_years):.4f}",
            f"Np = ({qi_stbd}/{decline_per_year}) * "
            f"(1 - exp(-{decline_per_year}*{t_years})) * 365.25 = {np_stb:.1f} STB",
        ]
    return CalcResult(
        name="Arps Exponential Cumulative Production",
        formula="Np = (qi / D) * (1 - exp(-D * t))",
        inputs={"qi_stbd": qi_stbd, "decline_per_year": decline_per_year, "t_years": t_years},
        result=np_stb,
        unit="STB",
        steps=steps,
        notes=notes,
    )


def arps_harmonic_rate(qi_stbd: float, decline_per_year: float, t_years: float) -> CalcResult:
    """Arps harmonic decline: q(t) = qi / (1 + D t)."""
    denom = 1 + decline_per_year * t_years
    q = qi_stbd / denom
    notes = _decline_notes(qi_stbd, decline_per_year, t_years)
    if denom <= 0:
        notes.append("Harmonic denominator <= 0; result is not physically meaningful.")
    return CalcResult(
        name="Arps Harmonic Decline Rate",
        formula="q(t) = qi / (1 + D * t)",
        inputs={"qi_stbd": qi_stbd, "decline_per_year": decline_per_year, "t_years": t_years},
        result=q,
        unit="STB/d",
        steps=[
            f"denominator = 1 + {decline_per_year} * {t_years} = {denom:.4f}",
            f"q = {qi_stbd} / {denom:.4f} = {q:.1f} STB/d",
        ],
        notes=notes,
    )


def arps_hyperbolic_rate(qi_stbd: float, decline_per_year: float, b_factor: float,
                         t_years: float) -> CalcResult:
    """
    Arps hyperbolic decline: q(t) = qi / (1 + b D t)^(1/b).

    b = 0 is the exponential limit and b = 1 is harmonic. Typical empirical oil-well
    decline uses 0 <= b <= 1, though some transient datasets fit outside that range.
    """
    notes = _decline_notes(qi_stbd, decline_per_year, t_years)
    if b_factor == 0:
        q = qi_stbd * math.exp(-decline_per_year * t_years)
        steps = [
            "b = 0, so hyperbolic decline reduces to exponential decline.",
            f"q = {qi_stbd} * exp(-{decline_per_year} * {t_years}) = {q:.1f} STB/d",
        ]
    else:
        denom_base = 1 + b_factor * decline_per_year * t_years
        q = qi_stbd / (denom_base ** (1 / b_factor))
        steps = [
            f"base = 1 + b*D*t = 1 + {b_factor} * {decline_per_year} * {t_years} "
            f"= {denom_base:.4f}",
            f"q = {qi_stbd} / {denom_base:.4f}^(1/{b_factor}) = {q:.1f} STB/d",
        ]
        if denom_base <= 0:
            notes.append("Hyperbolic base <= 0; result is not physically meaningful.")
    if b_factor < 0 or b_factor > 1:
        notes.append("b-factor is outside the common 0 to 1 empirical range; verify fit quality.")
    return CalcResult(
        name="Arps Hyperbolic Decline Rate",
        formula="q(t) = qi / (1 + b * D * t)^(1/b)",
        inputs={
            "qi_stbd": qi_stbd,
            "decline_per_year": decline_per_year,
            "b_factor": b_factor,
            "t_years": t_years,
        },
        result=q,
        unit="STB/d",
        steps=steps,
        notes=notes,
    )


def _decline_notes(qi_stbd: float, decline_per_year: float, t_years: float) -> list[str]:
    notes: list[str] = []
    if qi_stbd < 0:
        notes.append("Initial rate is negative; check inputs.")
    if decline_per_year < 0:
        notes.append("Decline rate is negative, indicating growth rather than decline; verify intent.")
    if t_years < 0:
        notes.append("Time is negative; result is an extrapolation before the initial rate date.")
    return notes
