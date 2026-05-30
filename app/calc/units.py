"""
Unit registry and oilfield constants.

Why this file exists:
Oilfield work mixes unit systems in ways that have killed people (ppg vs sg,
psi vs bar, bbl vs m3). Every calculation in PetroBrain is dimensionally checked.
We use `pint` so that adding a pressure to a length raises an error instead of
silently producing a wrong, confident number.

Public functions accept plain floats *with explicit unit arguments* and return
plain floats in a stated unit, so the calc layer stays simple for callers while
remaining internally unit-safe.
"""
from __future__ import annotations

import pint

# A single shared registry. Define oilfield units the standard registry lacks.
ureg: pint.UnitRegistry = pint.UnitRegistry()
Q_ = ureg.Quantity

# Oilfield barrel (US petroleum barrel) = 42 US gallons
ureg.define("oil_barrel = 42 * US_gallon = bbl")
# Pounds per gallon (mud weight) - mass density
ureg.define("ppg = pound / US_gallon")

# ---------------------------------------------------------------------------
# Industry-standard constants (documented, named, never magic numbers inline)
# ---------------------------------------------------------------------------

# Mud-weight pressure-gradient factor.
# 1 ppg of fluid exerts ~0.051948 psi per ft of TVD. The industry kill sheet
# uses the rounded 0.052. We expose both; default to the API/IWCF kill-sheet
# convention (0.052) so PetroBrain matches the sheets engineers hand-calculate,
# and provide PRECISE for engineering work that wants it.
MUD_GRADIENT_FACTOR = 0.052          # psi / (ppg * ft)  -- kill-sheet convention
MUD_GRADIENT_FACTOR_PRECISE = 0.051948

# Standard conditions for gas volume <-> moles (oilfield: 60 F, 14.696 psia)
SCF_PER_LBMOL = 379.49               # scf of ideal gas per lb-mol at 60F, 14.696 psia

# Conversions used widely
PSI_PER_BAR = 14.5037744
M3_PER_BBL = 0.158987294928
FT_PER_M = 3.280839895

# Specific gravity (water=1.0) to ppg: 1 SG = 8.33 ppg (fresh water at 8.33 lb/gal)
PPG_PER_SG = 8.33
