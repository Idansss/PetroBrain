-- Async admin document ingestion records (A5) with a status state machine:
--   queued -> extracting -> embedding -> done
--                                     \-> failed
-- Each transition is appended to status_history (jsonb). Tenant isolation via
-- WHERE-clause filtering in app code AND row-level security on the GUC.

CREATE TABLE IF NOT EXISTS admin_documents (
    ingest_id       TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    document_id     TEXT NOT NULL,
    title           TEXT NOT NULL,
    revision        TEXT NOT NULL DEFAULT '',
    jurisdiction    TEXT NOT NULL DEFAULT '',
    asset           TEXT,
    effective_date  TEXT,
    document_type   TEXT NOT NULL DEFAULT 'sop',
    filename        TEXT NOT NULL,
    content_type    TEXT NOT NULL DEFAULT '',
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    object_key      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'extracting', 'embedding', 'done', 'failed')),
    failure_reason  TEXT,
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    status_history  JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_utc     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_utc     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_documents_tenant_created
    ON admin_documents (tenant_id, created_utc DESC);

ALTER TABLE admin_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_admin_documents ON admin_documents;
CREATE POLICY tenant_isolation_admin_documents
ON admin_documents
FOR ALL
USING (current_setting('petrobrain.tenant_id') = tenant_id)
WITH CHECK (current_setting('petrobrain.tenant_id') = tenant_id);
