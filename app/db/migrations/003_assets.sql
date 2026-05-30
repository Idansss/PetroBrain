-- Asset hierarchy + relationships knowledge graph (A9).
--
-- ``assets`` is the spine of the operator's facility hierarchy, e.g.
-- Field → Block/OML → Train/Platform → Equipment. Documents and chat queries
-- carry an asset reference so retrieval can walk the tree to include the
-- ancestors' SOPs and standards.
--
-- ``asset_relationships`` records non-parent edges (depends_on, feeds, etc.)
-- so future modules (predictive maintenance, downstream advisory) can
-- traverse the graph without abusing the parent_id pointer.
--
-- Both tables are tenant-isolated via row-level security on the
-- ``petrobrain.tenant_id`` GUC, same contract as doc_chunks/audit_events.

CREATE TABLE IF NOT EXISTS assets (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    parent_id    TEXT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    type         TEXT NOT NULL,                         -- e.g. field | block | train | equipment
    name         TEXT NOT NULL,
    attributes   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_utc  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_utc  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_tenant ON assets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_parent ON assets (tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_type ON assets (tenant_id, type);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_assets ON assets;
CREATE POLICY tenant_isolation_assets
ON assets
FOR ALL
USING (current_setting('petrobrain.tenant_id') = tenant_id)
WITH CHECK (current_setting('petrobrain.tenant_id') = tenant_id);


CREATE TABLE IF NOT EXISTS asset_relationships (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    src_id       TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    dst_id       TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    relation     TEXT NOT NULL,
    attributes   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_utc  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, src_id, dst_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_asset_rel_tenant_src ON asset_relationships (tenant_id, src_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_tenant_dst ON asset_relationships (tenant_id, dst_id);

ALTER TABLE asset_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_relationships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_asset_relationships ON asset_relationships;
CREATE POLICY tenant_isolation_asset_relationships
ON asset_relationships
FOR ALL
USING (current_setting('petrobrain.tenant_id') = tenant_id)
WITH CHECK (current_setting('petrobrain.tenant_id') = tenant_id);
