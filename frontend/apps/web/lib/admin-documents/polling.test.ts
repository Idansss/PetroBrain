import { describe, expect, it } from 'vitest';

import { POLL_INTERVAL_MS, shouldKeepPolling } from './polling.js';
import type { AdminDocumentRow } from './types.js';

function row(status: AdminDocumentRow['status']): AdminDocumentRow {
  return {
    ingest_id: status,
    document_id: 'd',
    title: 'doc',
    revision: '',
    jurisdiction: '',
    asset: null,
    document_type: 'sop',
    filename: 'd.md',
    content_type: 'text/markdown',
    size_bytes: 1,
    status,
    chunk_count: 0,
    failure_reason: null,
    created_utc: '',
    updated_utc: '',
  };
}

describe('shouldKeepPolling', () => {
  it('returns false on an empty list (nothing to chase)', () => {
    expect(shouldKeepPolling([])).toBe(false);
  });

  it('returns false once every row has reached a terminal state', () => {
    expect(shouldKeepPolling([row('done'), row('failed')])).toBe(false);
  });

  it.each(['queued', 'extracting', 'embedding'] as const)(
    'polls every 5 s while at least one row is in %s',
    (status) => {
      expect(shouldKeepPolling([row(status), row('done')])).toBe(POLL_INTERVAL_MS);
    },
  );
});
