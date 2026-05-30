import { Providers } from '@/lib/admin-console/Providers';

import { DataReadinessClient } from './DataReadinessClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default function DataReadinessPage({ params }: PageProps) {
  return (
    <Providers>
      <DataReadinessClient tenantId={params.id} />
    </Providers>
  );
}
