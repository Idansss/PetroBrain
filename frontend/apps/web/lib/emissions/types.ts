/**
 * Wire types for /emissions/inventory and /emissions/inventories (A3).
 *
 * All numerics are produced by the backend engine; the UI is presentation
 * only. The shapes mirror app/modules/emissions_mrv/engine.py +
 * ghgemp_template.py so the OpenAPI client and these stay consistent.
 */

export type EmissionsTier = 'Tier 1' | 'Tier 2' | 'Tier 3' | string;

export type SourceType =
  | 'flaring'
  | 'venting'
  | 'fugitive_t2'
  | 'fugitive_t3'
  | 'combustion';

export interface InventoryLine {
  source_id: string;
  source_type: SourceType;
  tier: EmissionsTier;
  method: string;
  ch4_tonnes: number;
  co2_tonnes: number;
  n2o_tonnes: number;
  activity: Record<string, unknown>;
}

export interface InventoryTotals {
  ch4_tonnes: number;
  co2_tonnes: number;
  n2o_tonnes: number;
  co2e_tonnes: number;
  gwp_set: string;
}

export interface Inventory {
  facility_id: string;
  period: string;
  totals: InventoryTotals;
  tier_summary: Record<string, number>;
  lines: InventoryLine[];
}

export interface GhgempReport {
  report_type: string;
  jurisdiction: string;
  operator: string;
  asset: string | null;
  facility_id: string;
  reporting_period: string;
  prepared_by: string;
  generated_utc: string;
  gwp_basis: string;
  summary: {
    total_co2e_tonnes: number;
    total_ch4_tonnes: number;
    total_co2_tonnes: number;
    total_n2o_tonnes: number;
  };
  tier_status: {
    target_tier: string;
    lines_by_tier: Record<string, number>;
    tier_readiness_pct: number;
    gaps_to_target: unknown[];
  };
  source_inventory: InventoryLine[];
  methodology_notes: string[];
  compliance_flags: string[];
  audit_sha256: string;
}

export interface MrvReadiness {
  status: string;
  facility_id: string;
  reporting_period: string;
  target_tier: string;
  tier_readiness_pct: number;
  gap_count: number;
  priority_gaps: unknown[];
  gap_action_plan: unknown[];
  total_co2e_tonnes: number;
  total_ch4_tonnes: number;
  compliance_flags: string[];
  next_actions: string[];
  audit_sha256: string;
}

export interface InventoryResponse {
  inventory: Inventory;
  ghgemp_report: GhgempReport;
  mrv_readiness: MrvReadiness;
  inventory_id?: string;
  created_utc?: string;
}

export interface InventoryRequest {
  facility_id: string;
  period: string;
  operator: string;
  asset: string | null;
  gwp_set: string;
  target_tier: string;
  sources: Array<{
    source_id: string;
    source_type: SourceType;
    params: Record<string, unknown>;
  }>;
}

/**
 * Summary row returned by GET /emissions/inventories. Matches the
 * ``_summary`` projection in app/db/mrv_repository.py (narrower than the
 * full record so the list payload stays small).
 */
export interface InventoryHistoryRow {
  inventory_id: string;
  facility_id: string;
  period: string;
  operator: string;
  asset: string | null;
  status: string;
  tier_readiness_pct: number;
  gap_count: number;
  total_co2e_tonnes: number;
  audit_sha256: string;
  created_utc: string;
}

/** Full historic record returned by GET /emissions/inventories/{id}. */
export interface InventoryHistoryDetail extends InventoryHistoryRow {
  tenant_id: string;
  user_id: string;
  request: InventoryRequest;
  response: InventoryResponse;
}
