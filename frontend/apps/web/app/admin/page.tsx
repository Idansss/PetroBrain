import { Providers } from '@/lib/chat/Providers';

import { AdminLearningClient } from './AdminLearningClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'PetroBrain - Admin',
  description: 'Per-tenant feedback, prompt memory, and retrieval weights.',
};

export default function AdminPage() {
  return (
    <Providers>
      <AdminLearningClient />
    </Providers>
  );
}
