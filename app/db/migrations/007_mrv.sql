-- NUPRC MRV inventory records (emissions module). One row per submitted
-- inventory: derived summary columns for listing plus the full request/response
-- payloads as jsonb. Tenant isolation via WHERE-clause filtering in app code AND
-- row-level security on the petrobrain.tenant_id GUC.

CREATE TABLE IF NOT EXISTS mrv_inventories (
    inventory_id        TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    user_id             TEXT NOT NULL,
    facility_id         TEXT NOT NULL,
    period              TEXT NOT NULL,
    operator            TEXT NOT NULL,
    asset               TEXT NOT NULL,
    status              TEXT NOT NULL,
    tier_readiness_pct  DOUBLE PRECISION NOT NULL DEFAULT 0,
    gap_count           INTEGER NOT NULL DEFAULT 0,
    total_co2e_tonnes   DOUBLE PRECISION NOT NULL DEFAULT 0,
    audit_sha256        TEXT NOT NULL DEFAULT '',
    request             JSONB NOT NULL DEFAULT '{}'::jsonb,
    response            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_utc         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mrv_tenant_created ON mrv_inventories (tenant_id, created_utc DESC);

ALTER TABLE mrv_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrv_inventories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_mrv_inventories ON mrv_inventories;
CREATE POLICY tenant_isolation_mrv_inventories
ON mrv_inventories
FOR ALL
USING (current_setting('petrobrain.tenant_id') = tenant_id)
WITH CHECK (current_setting('petrobrain.tenant_id') = tenant_id);
