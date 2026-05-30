import type { AssetNode } from '@petrobrain/types';

interface RawAsset {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  type: string;
  name: string;
  attributes: Record<string, unknown>;
}

/** GET /assets?roots_only=true | ?parent_id=<id>. Always tenant-scoped server-side. */
export async function fetchAssets(opts: {
  baseUrl: string;
  token: string;
  parentId?: string | null;
  rootsOnly?: boolean;
  signal?: AbortSignal;
}): Promise<AssetNode[]> {
  const url = new URL('/assets', opts.baseUrl);
  if (opts.rootsOnly) url.searchParams.set('roots_only', 'true');
  if (opts.parentId) url.searchParams.set('parent_id', opts.parentId);
  const init: RequestInit = { headers: { Authorization: `Bearer ${opts.token}` } };
  if (opts.signal) init.signal = opts.signal;
  const resp = await fetch(url.toString(), init);
  if (!resp.ok) {
    throw new Error(`fetchAssets failed (${resp.status})`);
  }
  const body = (await resp.json()) as { assets: RawAsset[] };
  return body.assets.map((a) => ({
    id: a.id,
    tenantId: a.tenant_id,
    parentId: a.parent_id,
    type: a.type,
    name: a.name,
    attributes: a.attributes,
  }));
}
