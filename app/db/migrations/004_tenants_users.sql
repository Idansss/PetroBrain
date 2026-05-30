-- Tenant + user registry (B8).
--
-- Until B8 these were implicit:
--   * "tenant_id" appeared as a foreign-key string on doc_chunks,
--     assets, audit_events, admin_documents, etc., but with no central
--     table to register, suspend, or list tenants.
--   * "user_id" came from the JWT ``sub`` claim with no row in any
--     table; invite / role / deactivate had nowhere to land.
--
-- The platform_admin role (added in app/api/deps.py) is the principal
-- who can act across tenants. Tenant admins keep their existing
-- tenant-scoped authority.

CREATE TABLE IF NOT EXISTS tenants (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended')),
    attributes   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_utc  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_utc  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);

-- Platform admins bypass tenant RLS by setting
-- ``current_setting('petrobrain.tenant_id') = '*'`` before each query.
-- Tenant admins continue to see only their own row.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_self_visibility ON tenants;
CREATE POLICY tenant_self_visibility
ON tenants
FOR ALL
USING (
    current_setting('petrobrain.tenant_id') = '*'
    OR current_setting('petrobrain.tenant_id') = id
)
WITH CHECK (
    current_setting('petrobrain.tenant_id') = '*'
    OR current_setting('petrobrain.tenant_id') = id
);


CREATE TABLE IF NOT EXISTS users (
    id               TEXT PRIMARY KEY,
    tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email            TEXT NOT NULL,
    role             TEXT NOT NULL
                     CHECK (role IN ('platform_admin', 'admin', 'engineer', 'field', 'hse')),
    status           TEXT NOT NULL DEFAULT 'invited'
                     CHECK (status IN ('invited', 'active', 'deactivated')),
    allowed_assets   JSONB NOT NULL DEFAULT '[]'::jsonb,
    invited_at_utc   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_utc  TIMESTAMPTZ,
    created_utc      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_utc      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_status ON users (tenant_id, status);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users
ON users
FOR ALL
USING (
    current_setting('petrobrain.tenant_id') = '*'
    OR current_setting('petrobrain.tenant_id') = tenant_id
)
WITH CHECK (
    current_setting('petrobrain.tenant_id') = '*'
    OR current_setting('petrobrain.tenant_id') = tenant_id
);
