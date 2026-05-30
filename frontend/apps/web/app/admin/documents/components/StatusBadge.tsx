import { Badge } from '@petrobrain/ui';

import type { DocumentStatus } from '@/lib/admin-documents/types';

const STATUS_TONE: Record<DocumentStatus, 'neutral' | 'info' | 'safe' | 'warn' | 'danger'> = {
  queued: 'neutral',
  extracting: 'info',
  embedding: 'info',
  done: 'safe',
  failed: 'danger',
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}
