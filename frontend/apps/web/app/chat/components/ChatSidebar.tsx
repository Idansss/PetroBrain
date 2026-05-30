'use client';

import { useQuery } from '@tanstack/react-query';

import type { Module } from '@petrobrain/types';
import { Badge, Button, Select } from '@petrobrain/ui';

import { fetchAssets } from '@/lib/chat/assets';
import { useChatStore } from '@/lib/chat/store';

const MODULE_OPTIONS: { value: Module; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'well_control', label: 'Well Control' },
  { value: 'emissions_mrv', label: 'Emissions / MRV' },
];

export function ChatSidebar() {
  const token = useChatStore((s) => s.token);
  const apiBaseUrl = useChatStore((s) => s.apiBaseUrl);
  const principal = useChatStore((s) => s.principal);
  const module = useChatStore((s) => s.module);
  const setModule = useChatStore((s) => s.setModule);
  const assetContext = useChatStore((s) => s.assetContext);
  const setAssetContext = useChatStore((s) => s.setAssetContext);
  const setToken = useChatStore((s) => s.setToken);

  const assets = useQuery({
    queryKey: ['assets', 'roots'],
    queryFn: ({ signal }) =>
      fetchAssets({ baseUrl: apiBaseUrl, token: token!, rootsOnly: true, signal }),
    enabled: Boolean(token),
  });

  const options = [
    { value: '', label: '— No asset context —' },
    ...((assets.data ?? []).map((a) => ({
      value: a.id,
      label: `${a.type}: ${a.name}`,
    }))),
  ];

  return (
    <aside className="flex h-screen flex-col gap-4 border-r border-neutral-200 bg-neutral-50 p-4">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">PetroBrain</p>
        <h2 className="text-base font-semibold text-neutral-800">Workspace</h2>
      </header>

      {principal ? (
        <section className="space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Signed in</p>
          <div className="flex items-center gap-2">
            <Badge tone="info">{principal.role}</Badge>
            <span className="font-medium text-neutral-800">{principal.userId}</span>
          </div>
          <p className="text-xs text-neutral-500">tenant: {principal.tenantId}</p>
        </section>
      ) : null}

      <Select
        label="Module"
        value={module}
        onChange={(e) => setModule(e.target.value as Module)}
        options={MODULE_OPTIONS}
      />

      <Select
        label="Asset context"
        value={assetContext ?? ''}
        onChange={(e) => setAssetContext(e.target.value || null)}
        options={options}
        {...(assets.isError
          ? { error: 'Could not load assets — check API base URL or auth.' }
          : assets.isLoading
            ? { hint: 'Loading assets…' }
            : { hint: 'Used to filter retrieved citations to the relevant asset.' })}
      />

      <div className="mt-auto pt-2">
        <Button variant="ghost" size="sm" onClick={() => setToken(null)}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
