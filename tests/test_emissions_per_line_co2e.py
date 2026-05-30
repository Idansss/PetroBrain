"""Per-line CO2e in the inventory serialization (source-table contribution
column). Each line carries co2e_tonnes using the inventory GWP set, and the
lines sum to the inventory total."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.modules.emissions_mrv.engine import (
    build_inventory,
    combustion,
    flaring,
    fugitive_tier2,
)


def test_each_line_has_co2e_summing_to_totals():
    lines = [
        flaring("FL-1", 1_000_000, {"CH4": 1.0}, combustion_efficiency=0.98),
        fugitive_tier2("A-1", {"valve": 100}, 8760),
        combustion("C-1", 500_000, co2_kg_per_scf=0.05, ch4_kg_per_scf=1e-6),
    ]
    inv = build_inventory("F1", "2026-Q3", lines, gwp_set="AR6").as_dict()

    assert all("co2e_tonnes" in line for line in inv["lines"])
    assert all(line["co2e_tonnes"] >= 0 for line in inv["lines"])
    line_sum = round(sum(line["co2e_tonnes"] for line in inv["lines"]), 2)
    assert line_sum == round(inv["totals"]["co2e_tonnes"], 2)
