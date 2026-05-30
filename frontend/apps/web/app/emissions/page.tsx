import { Providers } from '@/lib/chat/Providers';

import { EmissionsClient } from './EmissionsClient';

export const dynamic = 'force-dynamic';

export default function EmissionsPage() {
  return (
    <Providers>
      <EmissionsClient />
    </Providers>
  );
}
