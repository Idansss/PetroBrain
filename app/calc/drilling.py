"""
Core drilling & well-pressure calculations.

Every function:
  - documents the formula by name
  - is pure and deterministic (the LLM NEVER does this arithmetic itself)
  - returns a CalcResult carrying the formula, inputs, steps, result and a
    plausibility note, so the API/agent can show the working and the system
    prompt's "show your working" rule is satisfied structurally.

References: standard well-control / drilling-engineering relationships
(IWCF/IADC well control, Bourgoyne et al. Applied Drilling Engineering).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .units import MUD_GRADIENT_FACTOR


@dataclass
class CalcResult:
    name: str
    formula: str
    inputs: dict[str, Any]
    result: float
    unit: str
    steps: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    safety_critical: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "formula": self.formula,
            "inputs": self.inputs,
            "result": round(self.result, 4),
            "unit": self.unit,
            "steps": self.steps,
            "notes": self.notes,
            "safety_critical": self.safety_critical,
        }


def hydrostatic_pressure(mw_ppg: float, tvd_ft: float) -> CalcResult:
    """HP (psi) = 0.052 * MW(ppg) * TVD(ft)."""
    hp = MUD_GRADIENT_FACTOR * mw_ppg * tvd_ft
    notes = []
    if mw_ppg <= 0 or tvd_ft < 0:
        notes.append("WARNING: non-physical input (mw<=0 or tvd<0).")
    return CalcResult(
        name="Hydrostatic Pressure",
        formula="HP = 0.052 * MW * TVD",
        inputs={"mw_ppg": mw_ppg, "tvd_ft": tvd_ft},
        result=hp,
        unit="psi",
        steps=[f"HP = {MUD_GRADIENT_FACTOR} * {mw_ppg} * {tvd_ft} = {hp:.1f} psi"],
        notes=notes,
    )


def equivalent_circulating_density(
    mw_ppg: float, annular_pressure_loss_psi: float, tvd_ft: float
) -> CalcResult:
    """ECD (ppg) = MW + APL / (0.052 * TVD)."""
    ecd = mw_ppg + annular_pressure_loss_psi / (MUD_GRADIENT_FACTOR * tvd_ft)
    notes = []
    if ecd - mw_ppg > 2.0:
        notes.append(
            "ECD is >2 ppg above static MW - check annular pressure loss / hole cleaning."
        )
    return CalcResult(
        name="Equivalent Circulating Density",
        formula="ECD = MW + APL / (0.052 * TVD)",
        inputs={
            "mw_ppg": mw_ppg,
            "annular_pressure_loss_psi": annular_pressure_loss_psi,
            "tvd_ft": tvd_ft,
        },
        result=ecd,
        unit="ppg",
        steps=[
            f"ECD = {mw_ppg} + {annular_pressure_loss_psi} / "
            f"({MUD_GRADIENT_FACTOR} * {tvd_ft}) = {ecd:.3f} ppg"
        ],
        notes=notes,
    )


def kill_mud_weight(omw_ppg: float, sidpp_psi: float, tvd_ft: float) -> CalcResult:
    """
    Kill Mud Weight: KMW = OMW + SIDPP / (0.052 * TVD).
    Safety-critical: this is the mud weight required to balance formation pressure
    during a well-control event.
    """
    kmw = omw_ppg + sidpp_psi / (MUD_GRADIENT_FACTOR * tvd_ft)
    notes = ["Verify with the well-control procedure and the competent person on site."]
    if kmw - omw_ppg > 4.0:
        notes.append(
            "KMW is >4 ppg over original MW - large underbalance; re-check SIDPP and TVD."
        )
    return CalcResult(
        name="Kill Mud Weight",
        formula="KMW = OMW + SIDPP / (0.052 * TVD)",
        inputs={"omw_ppg": omw_ppg, "sidpp_psi": sidpp_psi, "tvd_ft": tvd_ft},
        result=kmw,
        unit="ppg",
        steps=[
            f"KMW = {omw_ppg} + {sidpp_psi} / ({MUD_GRADIENT_FACTOR} * {tvd_ft}) "
            f"= {kmw:.2f} ppg"
        ],
        notes=notes,
        safety_critical=True,
    )


def maasp(
    max_allowable_mw_ppg: float, current_mw_ppg: float, shoe_tvd_ft: float
) -> CalcResult:
    """
    Maximum Allowable Annular Surface Pressure.
    MAASP = 0.052 * (MAMW - current MW) * shoe TVD
    where MAMW is derived from the LOT/FIT at the casing shoe.
    """
    value = MUD_GRADIENT_FACTOR * (max_allowable_mw_ppg - current_mw_ppg) * shoe_tvd_ft
    notes = ["Recompute MAASP whenever mud weight in the hole changes."]
    if value <= 0:
        notes.append(
            "MAASP <= 0: current MW already at/above the formation strength at the shoe."
        )
    return CalcResult(
        name="Maximum Allowable Annular Surface Pressure",
        formula="MAASP = 0.052 * (MAMW - MW) * shoe_TVD",
        inputs={
            "max_allowable_mw_ppg": max_allowable_mw_ppg,
            "current_mw_ppg": current_mw_ppg,
            "shoe_tvd_ft": shoe_tvd_ft,
        },
        result=value,
        unit="psi",
        steps=[
            f"MAASP = {MUD_GRADIENT_FACTOR} * ({max_allowable_mw_ppg} - {current_mw_ppg}) "
            f"* {shoe_tvd_ft} = {value:.0f} psi"
        ],
        notes=notes,
        safety_critical=True,
    )
