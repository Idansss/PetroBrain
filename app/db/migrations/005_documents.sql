-- Document ingestion records for the Phase-1 ingestion UI (GET /documents).
--
-- This is NOT the RAG vector table (that is doc_chunks, see vectorstore.SCHEMA +
-- migration 001). A row here is one uploaded document plus its produced chunk
-- list and metadata, surfaced in the web app's documents listing. Tenant
-- isolation matches the rest of the schema: WHERE-clause filtering in app code
-- AND row-level security on the petrobrain.tenant_id GUC.

CREATE TABLE IF NOT EXISTS documents (
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
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    chunks          JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_utc     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_created ON documents (tenant_id, created_utc DESC);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_documents ON documents;
CREATE POLICY tenant_isolation_documents
ON documents
FOR ALL
USING (current_setting('petrobrain.tenant_id') = tenant_id)
WITH CHECK (current_setting('petrobrain.tenant_id') = tenant_id);
