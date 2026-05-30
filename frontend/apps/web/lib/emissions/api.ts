/**
 * Thin wrappers around /emissions/inventory and /emissions/inventories
 * (A3 + pre-existing). The shapes match app/api/routes_emissions.py.
 */
import type {
  InventoryHistoryDetail,
  InventoryHistoryRow,
  InventoryRequest,
  InventoryResponse,
} from './types.js';

interface RequestOpts {
  baseUrl: string;
  token: string;
  signal?: AbortSignal;
}

export async function listInventories(opts: RequestOpts): Promise<InventoryHistoryRow[]> {
  const init: RequestInit = { headers: { Authorization: `Bearer ${opts.token}` } };
  if (opts.signal) init.signal = opts.signal;
  const resp = await fetch(new URL('/emissions/inventories', opts.baseUrl), init);
  if (!resp.ok) throw await apiError(resp);
  const body = (await resp.json()) as { inventories: InventoryHistoryRow[] };
  return body.inventories;
}

export async function getInventory(
  opts: RequestOpts & { inventoryId: string },
): Promise<InventoryHistoryDetail> {
  const init: RequestInit = { headers: { Authorization: `Bearer ${opts.token}` } };
  if (opts.signal) init.signal = opts.signal;
  const resp = await fetch(
    new URL(`/emissions/inventories/${opts.inventoryId}`, opts.baseUrl),
    init,
  );
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as InventoryHistoryDetail;
}

export async function createInventory(
  opts: RequestOpts & { body: InventoryRequest },
): Promise<InventoryResponse> {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts.body),
  };
  if (opts.signal) init.signal = opts.signal;
  const resp = await fetch(new URL('/emissions/inventory', opts.baseUrl), init);
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as InventoryResponse;
}

async function apiError(resp: Response): Promise<Error> {
  let detail = '';
  try {
    const body = (await resp.clone().json()) as { detail?: unknown };
    detail = typeof body?.detail === 'string' ? body.detail : JSON.stringify(body?.detail ?? '');
  } catch {
    detail = await resp.text().catch(() => '');
  }
  return new Error(`emissions API ${resp.status}: ${detail}`);
}
