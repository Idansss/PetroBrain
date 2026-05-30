'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@petrobrain/ui';

import { useChatStore } from '@/lib/chat/store';
import { createInventory, getInventory, listInventories } from '@/lib/emissions/api';
import type {
  InventoryHistoryDetail,
  InventoryRequest,
  InventoryResponse,
} from '@/lib/emissions/types';

import { HistoryFilters, applyHistoryFilters, type HistoryFilterState } from './HistoryFilters';
import { InventoryBuilder } from './InventoryBuilder';
import { InventoryHistory } from './InventoryHistory';
import { InventoryViewer } from './InventoryViewer';

const HISTORY_QUERY_KEY = ['emissions', 'history'] as const;
const inventoryQueryKey = (id: string) => ['emissions', 'inventory', id] as const;

export function EmissionsScreen() {
  const token = useChatStore((s) => s.token)!;
  const apiBaseUrl = useChatStore((s) => s.apiBaseUrl);
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<HistoryFilterState>({
    facility: '',
    year: 'all',
    quarter: 'all',
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const historyQuery = useQuery({
    queryKey: HISTORY_QUERY_KEY,
    queryFn: ({ signal }) => listInventories({ baseUrl: apiBaseUrl, token, signal }),
  });

  const detailQuery = useQuery({
    queryKey: selectedId ? inventoryQueryKey(selectedId) : ['emissions', 'inventory', '__none__'],
    queryFn: ({ signal }) =>
      getInventory({ baseUrl: apiBaseUrl, token, inventoryId: selectedId!, signal }),
    enabled: Boolean(selectedId),
  });

  const createMutation = useMutation({
    mutationFn: (request: InventoryRequest) =>
      createInventory({ baseUrl: apiBaseUrl, token, body: request }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
      // Hand the fresh response to the viewer immediately by caching it under
      // its new id; the next history refetch will reconcile.
      const id = response.inventory_id;
      if (id) {
        queryClient.setQueryData<InventoryHistoryDetail>(inventoryQueryKey(id), {
          inventory_id: id,
          tenant_id: '',
          user_id: '',
          facility_id: response.inventory.facility_id,
          period: response.inventory.period,
          operator: response.ghgemp_report.operator,
          asset: response.ghgemp_report.asset,
          status: response.mrv_readiness.status,
          tier_readiness_pct: response.mrv_readiness.tier_readiness_pct,
          gap_count: response.mrv_readiness.gap_count,
          total_co2e_tonnes: response.mrv_readiness.total_co2e_tonnes,
          audit_sha256: response.mrv_readiness.audit_sha256,
          created_utc: response.created_utc ?? new Date().toISOString(),
          request: {} as InventoryRequest,                  // not needed for viewer rendering
          response,
        });
        setSelectedId(id);
      }
      setComposerOpen(false);
    },
  });

  const filteredRows = useMemo(
    () => applyHistoryFilters(historyQuery.data ?? [], filters),
    [historyQuery.data, filters],
  );

  const viewerResponse: InventoryResponse | null = detailQuery.data?.response ?? null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-800">Emissions / MRV</h1>
          <p className="text-sm text-neutral-500">
            NUPRC Tier-3 inventories and GHGEMP report generation. Numbers come from the inventory
            engine — confirm GWP set and factors against current NUPRC guidance before filing.
          </p>
        </div>
        <Button
          variant={composerOpen ? 'ghost' : 'primary'}
          onClick={() => setComposerOpen((open) => !open)}
        >
          {composerOpen ? 'Close composer' : 'New inventory'}
        </Button>
      </header>

      {composerOpen ? (
        <InventoryBuilder
          pending={createMutation.isPending}
          error={createMutation.error instanceof Error ? createMutation.error.message : null}
          onSubmit={(req) => createMutation.mutate(req)}
          onCancel={() => setComposerOpen(false)}
        />
      ) : null}

      <section className="space-y-2" aria-label="History filters">
        <HistoryFilters rows={historyQuery.data ?? []} value={filters} onChange={setFilters} />
      </section>

      <section className="space-y-2" aria-label="Inventory history">
        <header>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Inventories — {filteredRows.length}
          </h2>
        </header>
        <InventoryHistory
          rows={filteredRows}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          isLoading={historyQuery.isLoading}
          isError={historyQuery.isError}
        />
      </section>

      {selectedId ? (
        <section className="space-y-2" aria-label="Selected inventory">
          {detailQuery.isLoading ? (
            <p className="text-sm text-neutral-500">Loading inventory…</p>
          ) : detailQuery.isError ? (
            <p role="alert" className="rounded-md border border-danger-border bg-danger-bg p-3 text-sm text-danger-fg">
              Could not load inventory detail.
            </p>
          ) : viewerResponse ? (
            <InventoryViewer response={viewerResponse} />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
