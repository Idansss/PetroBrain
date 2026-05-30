import * as SQLite from 'expo-sqlite';

import { SEED_CHUNKS, SEED_DOCUMENTS } from './seed.js';
import type { CachedChunk, CachedDocument } from './types.js';

const DB_NAME = 'petrobrain-field.db';
const SCHEMA_VERSION = 3;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndInit();
  }
  return dbPromise;
}

async function openAndInit(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      revision TEXT NOT NULL,
      asset TEXT,
      document_type TEXT NOT NULL,
      text TEXT NOT NULL,
      updated_utc TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      clause TEXT,
      text TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      occurred_utc TEXT NOT NULL,
      detail TEXT
    );

    CREATE TABLE IF NOT EXISTS permits (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      created_utc TEXT NOT NULL,
      updated_utc TEXT NOT NULL,
      form_json TEXT NOT NULL,
      generated_json TEXT NOT NULL,
      signatures_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_permits_tenant ON permits(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);

    CREATE TABLE IF NOT EXISTS outgoing_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      queued_utc TEXT NOT NULL,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS calc_results (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      calc_name TEXT NOT NULL,
      family TEXT NOT NULL,
      inputs_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_utc TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_calc_tenant_created
      ON calc_results(tenant_id, created_utc DESC);
  `);
  const versionRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM schema_meta WHERE key = 'version'",
  );
  const existing = versionRow ? Number(versionRow.value) : 0;
  if (existing < SCHEMA_VERSION) {
    await seedIfEmpty(db);
    await db.runAsync(
      "INSERT OR REPLACE INTO schema_meta(key, value) VALUES('version', ?)",
      String(SCHEMA_VERSION),
    );
  }
  return db;
}

async function seedIfEmpty(db: SQLite.SQLiteDatabase): Promise<void> {
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM documents');
  if ((count?.n ?? 0) > 0) return;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const doc of SEED_DOCUMENTS) {
      await txn.runAsync(
        `INSERT INTO documents (id, tenant_id, document_id, title, revision, asset, document_type, text, updated_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        doc.id,
        doc.tenant_id,
        doc.document_id,
        doc.title,
        doc.revision,
        doc.asset,
        doc.document_type,
        doc.text,
        doc.updated_utc,
      );
    }
    for (const chunk of SEED_CHUNKS) {
      await txn.runAsync(
        'INSERT INTO chunks (id, document_id, clause, text) VALUES (?, ?, ?, ?)',
        chunk.id,
        chunk.document_id,
        chunk.clause,
        chunk.text,
      );
    }
    await txn.runAsync(
      "INSERT INTO sync_log (kind, occurred_utc, detail) VALUES (?, ?, ?)",
      'seed',
      new Date().toISOString(),
      `Seeded ${SEED_DOCUMENTS.length} documents and ${SEED_CHUNKS.length} chunks.`,
    );
  });
}

export async function listDocuments(tenantId: string): Promise<CachedDocument[]> {
  const db = await getDb();
  return db.getAllAsync<CachedDocument>(
    `SELECT * FROM documents WHERE tenant_id = ? ORDER BY title ASC`,
    tenantId,
  );
}

export async function listChunksForDocuments(documentIds: string[]): Promise<CachedChunk[]> {
  if (documentIds.length === 0) return [];
  const db = await getDb();
  const placeholders = documentIds.map(() => '?').join(',');
  return db.getAllAsync<CachedChunk>(
    `SELECT * FROM chunks WHERE document_id IN (${placeholders})`,
    ...documentIds,
  );
}

export interface SyncLogEntry {
  id: number;
  kind: string;
  occurred_utc: string;
  detail: string | null;
}

export async function listSyncLog(limit = 20): Promise<SyncLogEntry[]> {
  const db = await getDb();
  return db.getAllAsync<SyncLogEntry>(
    'SELECT * FROM sync_log ORDER BY id DESC LIMIT ?',
    limit,
  );
}

export async function clearCache(): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM chunks');
    await txn.runAsync('DELETE FROM documents');
    await txn.runAsync(
      "INSERT INTO sync_log (kind, occurred_utc, detail) VALUES (?, ?, ?)",
      'clear',
      new Date().toISOString(),
      'Cache cleared by user.',
    );
  });
}
