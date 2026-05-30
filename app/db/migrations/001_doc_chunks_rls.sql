-- Enforce tenant isolation for RAG document chunks at the database layer.
-- Application code must set petrobrain.tenant_id transaction-locally before queries.

ALTER TABLE doc_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_chunks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_doc_chunks ON doc_chunks;

CREATE POLICY tenant_isolation_doc_chunks
ON doc_chunks
FOR ALL
USING (current_setting('petrobrain.tenant_id') = tenant_id)
WITH CHECK (current_setting('petrobrain.tenant_id') = tenant_id);
