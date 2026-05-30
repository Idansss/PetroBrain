'use client';

import { AuthGate } from '../chat/components/AuthGate';
import { useChatStore } from '@/lib/chat/store';

import { EmissionsScreen } from './components/EmissionsScreen';
import { RoleForbidden } from './components/RoleForbidden';

const ALLOWED_ROLES = new Set(['admin', 'engineer', 'hse']);

export function EmissionsClient() {
  const token = useChatStore((s) => s.token);
  const principal = useChatStore((s) => s.principal);

  if (!token || !principal) return <AuthGate />;
  if (!ALLOWED_ROLES.has(principal.role)) return <RoleForbidden role={principal.role} />;
  return <EmissionsScreen />;
}
