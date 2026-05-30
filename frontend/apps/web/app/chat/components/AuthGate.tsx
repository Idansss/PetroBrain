'use client';

import { useState } from 'react';

import { Banner, Button, Input } from '@petrobrain/ui';

import { decodePrincipal } from '@/lib/chat/jwt';
import { useChatStore } from '@/lib/chat/store';

/**
 * Dev sign-in: paste a JWT minted with the same secret/issuer/audience as
 * the backend. Production swaps this with SSO; the API client carries the
 * token regardless of where it came from.
 */
export function AuthGate() {
  const setToken = useChatStore((s) => s.setToken);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const principal = decodePrincipal(trimmed);
    if (!principal) {
      setError('Token is not a valid PetroBrain JWT.');
      return;
    }
    setError(null);
    setToken(trimmed);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-800">Sign in</h1>
        <p className="text-sm text-neutral-500">
          Paste a JWT minted with your backend&apos;s <code className="font-mono">PB_JWT_SECRET</code>.
        </p>
      </header>
      <Banner tone="info" title="Dev only">
        SSO sign-in lands in a later task. This screen exists to drive the chat surface against a
        running backend.
      </Banner>
      <form className="space-y-3" onSubmit={submit} aria-label="Sign in">
        <Input
          label="JWT"
          placeholder="eyJhbGciOi..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          {...(error ? { error } : {})}
        />
        <Button type="submit" variant="primary">
          Continue
        </Button>
      </form>
    </main>
  );
}
