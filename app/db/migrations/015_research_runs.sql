-- Persistent Research Mode plans, source ledgers, events, and final reports.

CREATE TABLE IF NOT EXISTS research_runs (
    id             TEXT PRIMARY KEY,
    tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id        TEXT NOT NULL,
    role           TEXT NOT NULL,
    status         TEXT NOT NULL,
    query          TEXT NOT NULL,
    config         JSONB NOT NULL DEFAULT '{}'::jsonb,
    plan           JSONB NOT NULL DEFAULT '[]'::jsonb,
    sources        JSONB NOT NULL DEFAULT '[]'::jsonb,
    report         JSONB,
    evidence_pack  JSONB NOT NULL DEFAULT '{}'::jsonb,
    events         JSONB NOT NULL DEFAULT '[]'::jsonb,
    flags          JSONB NOT NULL DEFAULT '[]'::jsonb,
    error          TEXT,
    created_utc    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_utc    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_runs_tenant_updated
    ON research_runs (tenant_id, updated_utc DESC);

CREATE INDEX IF NOT EXISTS idx_research_runs_tenant_user
    ON research_runs (tenant_id, user_id);

ALTER TABLE research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_research_runs ON research_runs;
CREATE POLICY tenant_isolation_research_runs
ON research_runs
FOR ALL
USING (
    current_setting('petrobrain.tenant_id') = '*'
    OR current_setting('petrobrain.tenant_id') = tenant_id
)
WITH CHECK (
    current_setting('petrobrain.tenant_id') = '*'
    OR current_setting('petrobrain.tenant_id') = tenant_id
);
