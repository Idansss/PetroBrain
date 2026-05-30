import { Providers } from '@/lib/admin-console/Providers';

import { AuditClient } from './AuditClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default function AuditPage({ params }: PageProps) {
  return (
    <Providers>
      <AuditClient tenantId={params.id} />
    </Providers>
  );
}
