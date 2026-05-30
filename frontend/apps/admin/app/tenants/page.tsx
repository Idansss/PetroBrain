import { Providers } from '@/lib/admin-console/Providers';

import { TenantsClient } from './TenantsClient';

export const dynamic = 'force-dynamic';

export default function TenantsPage() {
  return (
    <Providers>
      <TenantsClient />
    </Providers>
  );
}
