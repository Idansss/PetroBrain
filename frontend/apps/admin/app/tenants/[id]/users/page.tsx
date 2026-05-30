import { Providers } from '@/lib/admin-console/Providers';

import { UsersClient } from './UsersClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default function UsersPage({ params }: PageProps) {
  return (
    <Providers>
      <UsersClient tenantId={params.id} />
    </Providers>
  );
}
