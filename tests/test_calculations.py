"""
Validation tests. Run from the repo root: python -m pytest -q  (or run this file).
The numbers here are hand-checked against standard well-control / emissions math.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.calc.drilling import hydrostatic_pressure, equivalent_circulating_density, kill_mud_weight, maasp
from app.calc.production import (
    arps_exponential_cumulative,
    arps_exponential_rate,
    arps_harmonic_rate,
    arps_hyperbolic_rate,
    vogel_ipr,
)
from app.modules.well_control.kill_sheet import WellInputs, build_kill_sheet
from app.modules.well_control.agent import detect_live_event
from app.modules.emissions_mrv.engine import (
    flaring, venting, fugitive_tier2, fugitive_tier3, build_inventory,
)
from app.modules.emissions_mrv.ghgemp_template import build_ghgemp_report, build_mrv_readiness_summary


def approx(a, b, tol=1e-2):
    return abs(a - b) <= tol * max(1, abs(b))


def test_hydrostatic():
    # 0.052 * 9.6 * 10000 = 4992 psi
    assert approx(hydrostatic_pressure(9.6, 10000).result, 4992)


def test_ecd():
    # 9.6 + 200/(0.052*10000) = 9.6 + 0.3846 = 9.9846
    assert approx(equivalent_circulating_density(9.6, 200, 10000).result, 9.9846)


def test_kill_mud_weight():
    # 9.6 + 400/(0.052*10000) = 9.6 + 0.7692 = 10.369
    r = kill_mud_weight(9.6, 400, 10000)
    assert approx(r.result, 10.369)
    assert r.safety_critical is True


def test_maasp():
    # 0.052*(14-9.6)*5000 = 0.052*4.4*5000 = 1144
    assert approx(maasp(14.0, 9.6, 5000).result, 1144)


def test_vogel():
    # test point 500 STB/d at Pwf/Pr=0.5 -> denom = 1-0.1-0.2 = 0.7 -> qomax=714.3
    r = vogel_ipr(500, 1500, 3000)
    assert approx(r.result, 714.29)


def test_arps_exponential_rate():
    # q = 1000 * exp(-0.2 * 2) = 670.32 STB/d
    r = arps_exponential_rate(1000, 0.2, 2)
    assert approx(r.result, 670.32, tol=1e-3)
    assert r.unit == "STB/d"


def test_arps_exponential_cumulative():
    # Np = (1000 / 0.2) * (1 - exp(-0.2 * 2)) * 365.25 = 601,922 STB
    r = arps_exponential_cumulative(1000, 0.2, 2)
    assert approx(r.result, 601922, tol=1e-3)
    assert r.unit == "STB"


def test_arps_harmonic_rate():
    # q = 1000 / (1 + 0.2 * 2) = 714.29 STB/d
    r = arps_harmonic_rate(1000, 0.2, 2)
    assert approx(r.result, 714.29, tol=1e-3)


def test_arps_hyperbolic_rate():
    # q = 1000 / (1 + 0.5 * 0.2 * 2)^(1/0.5) = 694.44 STB/d
    r = arps_hyperbolic_rate(1000, 0.2, 0.5, 2)
    assert approx(r.result, 694.44, tol=1e-3)
    assert r.unit == "STB/d"


def test_kill_sheet_full():
    w = WellInputs(
        tvd_ft=10000, md_ft=10000, omw_ppg=9.6, sidpp_psi=400, sicp_psi=600,
        pit_gain_bbl=20, scr_pressure_psi=800, pump_output_bbl_per_stk=0.1,
        drill_string_volume_bbl=120, annulus_volume_bit_to_surface_bbl=180,
        annular_capacity_bbl_per_ft=0.0459, shoe_tvd_ft=5000, max_allowable_mw_ppg=14.0,
    )
    ks = build_kill_sheet(w, method="wait_and_weight")
    assert approx(ks.kill_mud_weight_ppg, 10.37, tol=2e-3)
    assert approx(ks.initial_circulating_pressure_psi, 1200)   # 400+800
    # FCP = 800 * 10.369/9.6 = 864
    assert approx(ks.final_circulating_pressure_psi, 864, tol=2e-3)
    assert approx(ks.strokes_surface_to_bit, 1200)             # 120/0.1
    assert approx(ks.strokes_bit_to_surface, 1800)             # 180/0.1
    assert ks.maasp_psi == 1144
    # pressure schedule starts at ICP, ends at FCP
    assert ks.pressure_schedule[0]["drill_pipe_pressure_psi"] == 1200
    assert abs(ks.pressure_schedule[-1]["drill_pipe_pressure_psi"] - 864) <= 1
    # influx gradient: 0.052*9.6 - (600-400)/H ; H = 20/0.0459 = 435.7 ft
    # = 0.4992 - 200/435.7 = 0.4992 - 0.459 = 0.040 -> gas
    assert ks.influx["inferred_fluid"].startswith("gas")
    assert "DECISION SUPPORT ONLY" in ks.banner


def test_live_event_detection():
    assert detect_live_event("We are taking a kick right now!") is True
    assert detect_live_event("What is the formula for ECD?") is False


def test_flaring_carbon_balance():
    # 1,000,000 scf of pure methane, CE = 0.98
    # lbmol = 1e6/379.49 = 2635.1
    # carbon lbmol = 2635.1 * 1 = 2635.1 ; CO2 = 2635.1*0.98*44.01 lb = 113,656 lb = 51.55 t
    # CH4 slip = 2635.1*0.02*16.043 lb = 845.6 lb = 0.3835 t
    line = flaring("FL-1", 1_000_000, {"CH4": 1.0}, combustion_efficiency=0.98)
    assert approx(line.co2_tonnes, 51.55, tol=1e-2)
    assert approx(line.ch4_tonnes, 0.3835, tol=2e-2)


def test_venting():
    # vent 100,000 scf pure methane -> all CH4
    # lbmol=263.51 -> CH4 lb = 263.51*16.043=4227.9 lb = 1.917 t
    line = venting("V-1", 100_000, {"CH4": 1.0})
    assert approx(line.ch4_tonnes, 1.917, tol=1e-2)
    assert line.co2_tonnes == 0.0


def test_fugitive_tiers_and_inventory():
    f2 = fugitive_tier2("AREA-1", {"valve": 100, "flange": 200}, operating_hours=8760)
    # valves: 100*0.0045*8760 = 3942 kg ; flanges: 200*0.00039*8760=683.3 kg => 4.6253 t
    assert approx(f2.ch4_tonnes, 4.6253, tol=1e-2)
    f3 = fugitive_tier3("AREA-2", [0.5, 0.3, 0.2], operating_hours=8760)  # 1.0 kg/hr total
    # 1.0*8760 = 8760 kg = 8.76 t
    assert approx(f3.ch4_tonnes, 8.76)
    inv = build_inventory("FAC-1", "2026-Q3", [f2, f3], gwp_set="AR6")
    t = inv.totals()
    # CO2e from CH4 only: (4.6253+8.76)*29.8 = 398.8 t
    assert approx(t["co2e_tonnes"], (4.6253 + 8.76) * 29.8, tol=1e-2)
    assert inv.tier_summary() == {"Tier 2": 1, "Tier 3": 1}


def test_ghgemp_report():
    f2 = fugitive_tier2("AREA-1", {"valve": 50}, 8760)
    f3 = fugitive_tier3("AREA-2", [0.2], 8760)
    inv = build_inventory("FAC-1", "2026-Q3", [f2, f3])
    rep = build_ghgemp_report(inv, operator="Acme E&P", asset="OML-XX", target_tier="Tier 3")
    assert rep["tier_status"]["tier_readiness_pct"] == 50.0  # 1 of 2 at Tier 3
    assert len(rep["tier_status"]["gaps_to_target"]) == 1
    assert rep["audit_sha256"]
    assert any("Tier 3" in f for f in rep["compliance_flags"])


def test_mrv_readiness_summary():
    f2 = fugitive_tier2("AREA-1", {"valve": 50}, 8760)
    f3 = fugitive_tier3("AREA-2", [0.2], 8760)
    inv = build_inventory("FAC-1", "2026-Q3", [f2, f3])
    rep = build_ghgemp_report(inv, operator="Acme E&P", asset="OML-XX", target_tier="Tier 3")
    summary = build_mrv_readiness_summary(rep)
    assert summary["status"] == "action_required"
    assert summary["tier_readiness_pct"] == 50.0
    assert summary["gap_count"] == 1
    assert summary["priority_gaps"][0]["source_id"] == "AREA-1"
    assert summary["gap_action_plan"][0]["source_id"] == "AREA-1"
    assert "OGI/LDAR" in summary["gap_action_plan"][0]["required_action"]
    assert summary["audit_sha256"] == rep["audit_sha256"]


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    passed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"FAIL  {fn.__name__}: {e}")
        except Exception as e:
            print(f"ERROR {fn.__name__}: {type(e).__name__}: {e}")
    print(f"\n{passed}/{len(fns)} passed")
