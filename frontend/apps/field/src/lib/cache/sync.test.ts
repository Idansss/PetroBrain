import { describe, expect, it } from 'vitest';

import type { CachedChunk, CachedDocument } from './types.js';
import { snapshotUrl, syncFromBackend, toCachedDocument, type SnapshotDocument } from './sync.js';

const doc: SnapshotDocument = {
  ingest_id: 'ing-1',
  tenant_id: 'tenant-a',
  document_id: 'SOP-1',
  title: 'Kick SOP',
  revision: 'B',
  asset: 'asset-a',
  document_type: 'sop',
  created_utc: '2026-05-30T10:00:00+00:00',
  chunks: [
    { clause: '1.0', text: 'First.' },
    { clause: '2.0', text: 'Second.' },
  ],
};

describe('snapshotUrl', () => {
  it('omits since when absent', () => {
    expect(snapshotUrl('http://api.local')).toBe('http://api.local/docs/snapshot');
  });
  it('encodes the timestamp + offset', () => {
    const url = snapshotUrl('http://api.local', '2026-05-30T10:00:00+00:00');
    expect(url).toContain('since=2026-05-30T10%3A00%3A00%2B00%3A00');
  });
});

describe('toCachedDocument', () => {
  it('maps doc + chunks and joins chunk text', () => {
    const { document, chunks } = toCachedDocument(doc);
    expect(document).toEqual<CachedDocument>({
      id: 'ing-1',
      tenant_id: 'tenant-a',
      document_id: 'SOP-1',
      title: 'Kick SOP',
      revision: 'B',
      asset: 'asset-a',
      document_type: 'sop',
      text: 'First.\n\nSecond.',
      updated_utc: '2026-05-30T10:00:00+00:00',
    });
    expect(chunks).toEqual<CachedChunk[]>([
      { id: 'ing-1:0', document_id: 'SOP-1', clause: '1.0', text: 'First.' },
      { id: 'ing-1:1', document_id: 'SOP-1', clause: '2.0', text: 'Second.' },
    ]);
  });
});

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('syncFromBackend', () => {
  it('upserts each document and tallies deltas', async () => {
    const upserted: Array<{ doc: CachedDocument; chunks: CachedChunk[] }> = [];
    const result = await syncFromBackend({
      baseUrl: 'http://api.local',
      token: 't',
      upsert: (d, c) => {
        upserted.push({ doc: d, chunks: c });
      },
      fetchImpl: fakeFetch({ documents: [doc], as_of: doc.created_utc, count: 1 }),
    });
    expect(result.ok).toBe(true);
    expect(result.delta_documents).toBe(1);
    expect(result.delta_chunks).toBe(2);
    expect(result.as_of).toBe(doc.created_utc);
    expect(upserted).toHaveLength(1);
    expect(upserted[0]!.doc.document_id).toBe('SOP-1');
  });

  it('reports failure on a non-2xx response', async () => {
    const result = await syncFromBackend({
      baseUrl: 'http://api.local',
      token: 't',
      fetchImpl: fakeFetch({}, 503),
    });
    expect(result.ok).toBe(false);
    expect(result.delta_documents).toBe(0);
    expect(result.note).toContain('503');
  });

  it('captures errors without throwing', async () => {
    const result = await syncFromBackend({
      baseUrl: 'http://api.local',
      token: 't',
      fetchImpl: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.note).toContain('offline');
  });
});
