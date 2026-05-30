"""
Emissions / MRV calculation engine (NUPRC Tier 2 -> Tier 3 ready).

Computes a facility GHG inventory from source-level activity data, converts to
CO2-equivalent using a configurable GWP set, and records the method/tier and the
factor sources for every line so the result is fully auditable.

Source types covered:
  - FLARING   : carbon balance on flared gas + methane slip from incomplete combustion
  - VENTING   : direct release of gas composition (CH4, CO2, ...)
  - FUGITIVE  : Tier 2 (component-count x average EF) OR Tier 3 (measured leak rates)
  - COMBUSTION: fuel volume x emission factor (engines, turbines, heaters)

Design intent: the SAME engine serves Tier 2 and Tier 3. The difference is the
*source of the numbers* (generic/averaged factors vs facility measurement), which is
recorded per line in `method`. This is exactly the transition NUPRC requires
(Tier 2 from Q3 2026 -> Tier 3 measurement-based from Jan 2027).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .factors import (
    COMPONENT_PROPERTIES,
    DEFAULT_FLARE_COMBUSTION_EFFICIENCY,
    DEFAULT_GWP_SET,
    GWP_SETS,
    MW_CH4,
    MW_CO2,
    TIER2_FUGITIVE_EF_KG_CH4_PER_COMPONENT_HR,
)

SCF_PER_LBMOL = 379.49
LB_PER_KG = 2.2046226218
KG_PER_TONNE = 1000.0


def _lb_to_tonne(lb: float) -> float:
    return lb / LB_PER_KG / KG_PER_TONNE


@dataclass
class EmissionLine:
    source_id: str
    source_type: str          # flaring | venting | fugitive | combustion
    tier: str                 # "Tier 2" | "Tier 3"
    method: str               # human-readable method + factor source (audit)
    ch4_tonnes: float = 0.0
    co2_tonnes: float = 0.0
    n2o_tonnes: float = 0.0
    activity: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        d = self.__dict__.copy()
        for k in ("ch4_tonnes", "co2_tonnes", "n2o_tonnes"):
            d[k] = round(d[k], 4)
        return d


def _normalize_composition(comp: dict[str, float]) -> dict[str, float]:
    total = sum(comp.values())
    if total <= 0:
        raise ValueError("gas composition mole fractions must sum to > 0")
    return {k: v / total for k, v in comp.items()}


def flaring(
    source_id: str,
    gas_volume_scf: float,
    composition: dict[str, float],
    combustion_efficiency: float | None = None,
    measured: bool = False,
) -> EmissionLine:
    """
    Carbon balance:
      lbmol gas = V / 379.49
      combusted carbon -> CO2 ; un-combusted CH4 -> methane slip ; feed CO2 passes through.
    """
    ce = combustion_efficiency if combustion_efficiency is not None else DEFAULT_FLARE_COMBUSTION_EFFICIENCY
    comp = _normalize_composition(composition)
    lbmol = gas_volume_scf / SCF_PER_LBMOL

    # Carbon from hydrocarbons (exclude feed CO2, which we pass through separately)
    hc_carbon_lbmol = sum(
        comp.get(c, 0.0) * COMPONENT_PROPERTIES[c]["carbon"]
        for c in COMPONENT_PROPERTIES
        if c not in ("CO2", "N2", "H2S")
    ) * lbmol

    # CO2: combusted hydrocarbon carbon -> CO2, plus any CO2 in the feed passes through
    co2_from_combustion_lb = hc_carbon_lbmol * ce * MW_CO2
    feed_co2_lb = comp.get("CO2", 0.0) * lbmol * MW_CO2
    co2_lb = co2_from_combustion_lb + feed_co2_lb

    # CH4 slip: methane that fails to combust
    ch4_slip_lb = comp.get("CH4", 0.0) * lbmol * (1 - ce) * MW_CH4

    return EmissionLine(
        source_id=source_id,
        source_type="flaring",
        tier="Tier 3" if measured else "Tier 2",
        method=(
            f"Carbon-balance flaring, combustion efficiency {ce:.3f} "
            f"({'measured' if measured else 'default factor'})"
        ),
        ch4_tonnes=_lb_to_tonne(ch4_slip_lb),
        co2_tonnes=_lb_to_tonne(co2_lb),
        activity={"gas_volume_scf": gas_volume_scf, "combustion_efficiency": ce},
    )


def venting(source_id: str, gas_volume_scf: float, composition: dict[str, float],
            measured: bool = False) -> EmissionLine:
    """Direct release: each GHG component emitted as-is (no combustion)."""
    comp = _normalize_composition(composition)
    lbmol = gas_volume_scf / SCF_PER_LBMOL
    ch4_lb = comp.get("CH4", 0.0) * lbmol * MW_CH4
    co2_lb = comp.get("CO2", 0.0) * lbmol * MW_CO2
    return EmissionLine(
        source_id=source_id,
        source_type="venting",
        tier="Tier 3" if measured else "Tier 2",
        method=f"Direct vent of gas composition ({'measured' if measured else 'engineering estimate'})",
        ch4_tonnes=_lb_to_tonne(ch4_lb),
        co2_tonnes=_lb_to_tonne(co2_lb),
        activity={"gas_volume_scf": gas_volume_scf},
    )


def fugitive_tier2(source_id: str, component_counts: dict[str, int],
                   operating_hours: float) -> EmissionLine:
    """Tier 2 component-count method: sum(count x average EF) x hours."""
    ch4_kg = 0.0
    for ctype, count in component_counts.items():
        ef = TIER2_FUGITIVE_EF_KG_CH4_PER_COMPONENT_HR.get(
            ctype, TIER2_FUGITIVE_EF_KG_CH4_PER_COMPONENT_HR["other"]
        )
        ch4_kg += count * ef * operating_hours
    return EmissionLine(
        source_id=source_id,
        source_type="fugitive",
        tier="Tier 2",
        method="Average emission factors x component count (NUPRC/API EF set)",
        ch4_tonnes=ch4_kg / KG_PER_TONNE,
        activity={"component_counts": component_counts, "operating_hours": operating_hours},
    )


def fugitive_tier3(source_id: str, measured_leaks_kg_ch4_per_hr: list[float],
                   operating_hours: float) -> EmissionLine:
    """
    Tier 3 measurement-based: leak rates quantified by OGI/LDAR / hi-flow sampling,
    summed and scaled to the reporting period. This is the directive's end-state.
    """
    total_rate = sum(measured_leaks_kg_ch4_per_hr)
    ch4_kg = total_rate * operating_hours
    return EmissionLine(
        source_id=source_id,
        source_type="fugitive",
        tier="Tier 3",
        method="Measurement-based (OGI/LDAR quantified leak rates) scaled to period",
        ch4_tonnes=ch4_kg / KG_PER_TONNE,
        activity={
            "n_leaks": len(measured_leaks_kg_ch4_per_hr),
            "total_rate_kg_hr": round(total_rate, 4),
            "operating_hours": operating_hours,
        },
    )


def combustion(source_id: str, fuel_scf: float,
               co2_kg_per_scf: float, ch4_kg_per_scf: float = 0.0,
               n2o_kg_per_scf: float = 0.0, measured: bool = False) -> EmissionLine:
    """Stationary combustion (engines/turbines/heaters) via fuel x emission factor."""
    return EmissionLine(
        source_id=source_id,
        source_type="combustion",
        tier="Tier 3" if measured else "Tier 2",
        method=f"Fuel-based emission factors ({'CEMS/measured' if measured else 'standard EF'})",
        co2_tonnes=fuel_scf * co2_kg_per_scf / KG_PER_TONNE,
        ch4_tonnes=fuel_scf * ch4_kg_per_scf / KG_PER_TONNE,
        n2o_tonnes=fuel_scf * n2o_kg_per_scf / KG_PER_TONNE,
        activity={"fuel_scf": fuel_scf},
    )


@dataclass
class Inventory:
    facility_id: str
    period: str
    gwp_set: str
    lines: list[EmissionLine]

    def totals(self) -> dict[str, float | str]:
        gwp = GWP_SETS[self.gwp_set]
        ch4 = sum(l.ch4_tonnes for l in self.lines)
        co2 = sum(l.co2_tonnes for l in self.lines)
        n2o = sum(l.n2o_tonnes for l in self.lines)
        co2e = co2 * gwp["CO2"] + ch4 * gwp["CH4"] + n2o * gwp["N2O"]
        return {
            "ch4_tonnes": round(ch4, 3),
            "co2_tonnes": round(co2, 3),
            "n2o_tonnes": round(n2o, 3),
            "co2e_tonnes": round(co2e, 3),
            "gwp_set": self.gwp_set,
        }

    def methane_intensity(self, gas_throughput_scf: float) -> float | None:
        """CH4 emitted as % of gas handled - a key NUPRC/OGMP-style metric."""
        if gas_throughput_scf <= 0:
            return None
        ch4_kg = sum(l.ch4_tonnes for l in self.lines) * KG_PER_TONNE
        # crude mass of throughput methane omitted; intensity here = CH4 tonnes / throughput
        return round(ch4_kg / gas_throughput_scf, 8)

    def tier_summary(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for l in self.lines:
            out[l.tier] = out.get(l.tier, 0) + 1
        return out

    def as_dict(self) -> dict[str, Any]:
        gwp = GWP_SETS[self.gwp_set]
        lines = []
        for l in self.lines:
            d = l.as_dict()
            # Per-line CO2e contribution, using the inventory's GWP set (the
            # line itself is GWP-agnostic). Sums to totals["co2e_tonnes"].
            d["co2e_tonnes"] = round(
                l.co2_tonnes * gwp["CO2"] + l.ch4_tonnes * gwp["CH4"] + l.n2o_tonnes * gwp["N2O"], 4
            )
            lines.append(d)
        return {
            "facility_id": self.facility_id,
            "period": self.period,
            "totals": self.totals(),
            "tier_summary": self.tier_summary(),
            "lines": lines,
        }


def build_inventory(facility_id: str, period: str, lines: list[EmissionLine],
                    gwp_set: str = DEFAULT_GWP_SET) -> Inventory:
    if gwp_set not in GWP_SETS:
        raise ValueError(f"unknown GWP set {gwp_set}")
    return Inventory(facility_id=facility_id, period=period, gwp_set=gwp_set, lines=lines)
