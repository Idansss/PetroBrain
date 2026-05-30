'use client';

import { AuthGate } from '../../chat/components/AuthGate';
import { useChatStore } from '@/lib/chat/store';

import { DocumentsScreen } from './components/DocumentsScreen';
import { Forbidden } from './components/Forbidden';

export function AdminDocumentsClient() {
  const token = useChatStore((s) => s.token);
  const principal = useChatStore((s) => s.principal);

  if (!token || !principal) return <AuthGate />;
  if (principal.role !== 'admin') return <Forbidden role={principal.role} />;
  return <DocumentsScreen />;
}
