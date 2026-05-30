"""Emissions MRV specialist tool wrappers for the orchestrator."""
from __future__ import annotations

from typing import Any

from .engine import (
    EmissionLine,
    build_inventory,
    combustion,
    flaring,
    fugitive_tier2,
    fugitive_tier3,
    venting,
)
from .ghgemp_template import build_ghgemp_report, build_mrv_readiness_summary

MODULE_TOOL_NOTE = (
    "Emission quantities are deterministic tool outputs from app/modules/emissions_mrv; "
    "the LLM must not recompute them in prose."
)

FLARING_TOOL = {
    "name": "flaring_emissions",
    "description": (
        "Calculate flaring emissions by carbon balance from gas volume, composition, "
        "and combustion efficiency. Returns a source-level MRV line item."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "source_id": {"type": "string"},
            "gas_volume_scf": {"type": "number"},
            "composition": {"type": "object", "additionalProperties": {"type": "number"}},
            "combustion_efficiency": {"type": "number"},
            "measured": {"type": "boolean"},
        },
        "required": ["source_id", "gas_volume_scf", "composition"],
    },
}

VENTING_TOOL = {
    "name": "venting_emissions",
    "description": (
        "Calculate direct venting emissions from gas volume and composition. Returns "
        "a source-level MRV line item."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "source_id": {"type": "string"},
            "gas_volume_scf": {"type": "number"},
            "composition": {"type": "object", "additionalProperties": {"type": "number"}},
            "measured": {"type": "boolean"},
        },
        "required": ["source_id", "gas_volume_scf", "composition"],
    },
}

FUGITIVE_TIER2_TOOL = {
    "name": "fugitive_tier2",
    "description": (
        "Calculate fugitive methane emissions using Tier 2 component counts and "
        "operating hours. Returns a source-level MRV line item."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "source_id": {"type": "string"},
            "component_counts": {"type": "object", "additionalProperties": {"type": "integer"}},
            "operating_hours": {"type": "number"},
        },
        "required": ["source_id", "component_counts", "operating_hours"],
    },
}

FUGITIVE_TIER3_TOOL = {
    "name": "fugitive_tier3",
    "description": (
        "Calculate measurement-based fugitive methane emissions from quantified leak "
        "rates and operating hours. Returns a source-level MRV line item."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "source_id": {"type": "string"},
            "measured_leaks_kg_ch4_per_hr": {
                "type": "array",
                "items": {"type": "number"},
            },
            "operating_hours": {"type": "number"},
        },
        "required": ["source_id", "measured_leaks_kg_ch4_per_hr", "operating_hours"],
    },
}

COMBUSTION_TOOL = {
    "name": "combustion_emissions",
    "description": (
        "Calculate stationary combustion emissions from fuel volume and emission "
        "factors. Returns a source-level MRV line item."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "source_id": {"type": "string"},
            "fuel_scf": {"type": "number"},
            "co2_kg_per_scf": {"type": "number"},
            "ch4_kg_per_scf": {"type": "number"},
            "n2o_kg_per_scf": {"type": "number"},
            "measured": {"type": "boolean"},
        },
        "required": ["source_id", "fuel_scf", "co2_kg_per_scf"],
    },
}

BUILD_GHGEMP_REPORT_TOOL = {
    "name": "build_ghgemp_report",
    "description": (
        "Build an audit-ready GHGEMP/MRV report from deterministic source-level "
        "emission line items. Does not compute source emissions itself."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "facility_id": {"type": "string"},
            "period": {"type": "string"},
            "operator": {"type": "string"},
            "asset": {"type": "string"},
            "gwp_set": {"type": "string", "default": "AR6"},
            "target_tier": {"type": "string", "default": "Tier 3"},
            "jurisdiction": {"type": "string", "default": "Nigeria (NUPRC)"},
            "prepared_by": {"type": "string", "default": "PetroBrain MRV"},
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "source_id": {"type": "string"},
                        "source_type": {"type": "string"},
                        "tier": {"type": "string"},
                        "method": {"type": "string"},
                        "ch4_tonnes": {"type": "number"},
                        "co2_tonnes": {"type": "number"},
                        "n2o_tonnes": {"type": "number"},
                        "activity": {"type": "object"},
                    },
                    "required": ["source_id", "source_type", "tier", "method"],
                },
            },
        },
        "required": ["facility_id", "period", "operator", "asset", "lines"],
    },
}


def run_flaring_tool(args: dict[str, Any]) -> dict[str, Any]:
    return flaring(
        source_id=args["source_id"],
        gas_volume_scf=args["gas_volume_scf"],
        composition=args["composition"],
        combustion_efficiency=args.get("combustion_efficiency"),
        measured=args.get("measured", False),
    ).as_dict()


def run_venting_tool(args: dict[str, Any]) -> dict[str, Any]:
    return venting(
        source_id=args["source_id"],
        gas_volume_scf=args["gas_volume_scf"],
        composition=args["composition"],
        measured=args.get("measured", False),
    ).as_dict()


def run_fugitive_tier2_tool(args: dict[str, Any]) -> dict[str, Any]:
    return fugitive_tier2(
        source_id=args["source_id"],
        component_counts=args["component_counts"],
        operating_hours=args["operating_hours"],
    ).as_dict()


def run_fugitive_tier3_tool(args: dict[str, Any]) -> dict[str, Any]:
    return fugitive_tier3(
        source_id=args["source_id"],
        measured_leaks_kg_ch4_per_hr=args["measured_leaks_kg_ch4_per_hr"],
        operating_hours=args["operating_hours"],
    ).as_dict()


def run_combustion_tool(args: dict[str, Any]) -> dict[str, Any]:
    return combustion(
        source_id=args["source_id"],
        fuel_scf=args["fuel_scf"],
        co2_kg_per_scf=args["co2_kg_per_scf"],
        ch4_kg_per_scf=args.get("ch4_kg_per_scf", 0.0),
        n2o_kg_per_scf=args.get("n2o_kg_per_scf", 0.0),
        measured=args.get("measured", False),
    ).as_dict()


def run_build_ghgemp_report_tool(args: dict[str, Any]) -> dict[str, Any]:
    lines = [_line_from_dict(row) for row in args["lines"]]
    inventory = build_inventory(
        args["facility_id"],
        args["period"],
        lines,
        gwp_set=args.get("gwp_set", "AR6"),
    )
    report = build_ghgemp_report(
        inventory,
        operator=args["operator"],
        asset=args["asset"],
        jurisdiction=args.get("jurisdiction", "Nigeria (NUPRC)"),
        prepared_by=args.get("prepared_by", "PetroBrain MRV"),
        target_tier=args.get("target_tier", "Tier 3"),
    )
    return {
        "inventory": inventory.as_dict(),
        "ghgemp_report": report,
        "mrv_readiness": build_mrv_readiness_summary(report),
        "notes": [MODULE_TOOL_NOTE],
    }


def _line_from_dict(row: dict[str, Any]) -> EmissionLine:
    return EmissionLine(
        source_id=row["source_id"],
        source_type=row["source_type"],
        tier=row["tier"],
        method=row["method"],
        ch4_tonnes=float(row.get("ch4_tonnes", 0.0)),
        co2_tonnes=float(row.get("co2_tonnes", 0.0)),
        n2o_tonnes=float(row.get("n2o_tonnes", 0.0)),
        activity=dict(row.get("activity") or {}),
    )
