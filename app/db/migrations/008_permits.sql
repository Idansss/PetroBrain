-- Permits to-work (PTW) submitted from the field app's offline outgoing_queue.
-- The device generates the permit id offline, so the backend upsert is
-- idempotent (re-flushing the same queued permit is a no-op beyond updated_utc).
-- created_utc is the device's creation time; synced_utc is when the backend
-- received it. Tenant isolation via WHERE filter + RLS on the GUC.

CREATE TABLE IF NOT EXISTS permits (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    format       TEXT NOT NULL DEFAULT 'ptw',
    status       TEXT NOT NULL DEFAULT 'submitted',
    form         JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated    JSONB NOT NULL DEFAULT '{}'::jsonb,
    signatures   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_utc  TIMESTAMPTZ,
    synced_utc   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_utc  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permits_tenant_created ON permits (tenant_id, created_utc DESC);

ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_permits ON permits;
CREATE POLICY tenant_isolation_permits
ON permits
FOR ALL
USING (current_setting('petrobrain.tenant_id') = tenant_id)
WITH CHECK (current_setting('petrobrain.tenant_id') = tenant_id);
