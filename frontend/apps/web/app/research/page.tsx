import { Providers } from '@/lib/chat/Providers';

import { ResearchClient } from './ResearchClient';

export const dynamic = 'force-dynamic';

export default function ResearchPage() {
  return (
    <Providers>
      <ResearchClient />
    </Providers>
  );
}
