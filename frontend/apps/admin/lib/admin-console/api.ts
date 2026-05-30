/**
 * Thin wrappers around /admin/tenants, /admin/tenants/{id}/users,
 * /admin/data-readiness, /admin/audit.
 */
import type {
  AuditEventRow,
  DataReadiness,
  TenantRow,
  TenantStatus,
  UserRole,
  UserRow,
  UserStatus,
} from './types.js';

interface ReqOpts {
  baseUrl: string;
  token: string;
  signal?: AbortSignal;
}

async function asError(resp: Response): Promise<Error> {
  let detail = '';
  try {
    const body = (await resp.clone().json()) as { detail?: unknown };
    detail = typeof body?.detail === 'string' ? body.detail : JSON.stringify(body?.detail ?? '');
  } catch {
    detail = await resp.text().catch(() => '');
  }
  return new Error(`admin ${resp.status}: ${detail}`);
}

async function json<T>(resp: Response): Promise<T> {
  if (!resp.ok) throw await asError(resp);
  return (await resp.json()) as T;
}

function init(opts: ReqOpts, extra: RequestInit = {}): RequestInit {
  const headers = new Headers(extra.headers);
  headers.set('Authorization', `Bearer ${opts.token}`);
  if (extra.body) headers.set('Content-Type', 'application/json');
  const out: RequestInit = { ...extra, headers };
  if (opts.signal) out.signal = opts.signal;
  return out;
}

// ---- tenants --------------------------------------------------------------

export async function listTenants(opts: ReqOpts & { status?: TenantStatus }): Promise<TenantRow[]> {
  const url = new URL('/admin/tenants', opts.baseUrl);
  if (opts.status) url.searchParams.set('status', opts.status);
  const body = await json<{ tenants: TenantRow[] }>(await fetch(url, init(opts)));
  return body.tenants;
}

export async function getTenant(opts: ReqOpts & { id: string }): Promise<TenantRow> {
  return json<TenantRow>(await fetch(new URL(`/admin/tenants/${opts.id}`, opts.baseUrl), init(opts)));
}

export async function createTenant(
  opts: ReqOpts & { id: string; name: string; attributes?: Record<string, unknown> },
): Promise<TenantRow> {
  const body = JSON.stringify({ id: opts.id, name: opts.name, attributes: opts.attributes ?? {} });
  return json<TenantRow>(
    await fetch(new URL('/admin/tenants', opts.baseUrl), init(opts, { method: 'POST', body })),
  );
}

export async function setTenantStatus(
  opts: ReqOpts & { id: string; status: TenantStatus },
): Promise<TenantRow> {
  const body = JSON.stringify({ status: opts.status });
  return json<TenantRow>(
    await fetch(new URL(`/admin/tenants/${opts.id}`, opts.baseUrl), init(opts, { method: 'PATCH', body })),
  );
}

// ---- users ----------------------------------------------------------------

export async function listUsers(
  opts: ReqOpts & { tenantId: string; status?: UserStatus; role?: UserRole },
): Promise<UserRow[]> {
  const url = new URL(`/admin/tenants/${opts.tenantId}/users`, opts.baseUrl);
  if (opts.status) url.searchParams.set('status', opts.status);
  if (opts.role) url.searchParams.set('role', opts.role);
  const body = await json<{ users: UserRow[] }>(await fetch(url, init(opts)));
  return body.users;
}

export async function inviteUser(
  opts: ReqOpts & {
    tenantId: string;
    email: string;
    role: UserRole;
    allowedAssets?: string[];
  },
): Promise<UserRow> {
  const body = JSON.stringify({
    email: opts.email,
    role: opts.role,
    allowed_assets: opts.allowedAssets ?? [],
  });
  return json<UserRow>(
    await fetch(
      new URL(`/admin/tenants/${opts.tenantId}/users`, opts.baseUrl),
      init(opts, { method: 'POST', body }),
    ),
  );
}

export async function setUserRole(
  opts: ReqOpts & { tenantId: string; userId: string; role: UserRole },
): Promise<UserRow> {
  const body = JSON.stringify({ role: opts.role });
  return json<UserRow>(
    await fetch(
      new URL(`/admin/tenants/${opts.tenantId}/users/${opts.userId}/role`, opts.baseUrl),
      init(opts, { method: 'PATCH', body }),
    ),
  );
}

export async function setUserStatus(
  opts: ReqOpts & { tenantId: string; userId: string; status: UserStatus },
): Promise<UserRow> {
  const body = JSON.stringify({ status: opts.status });
  return json<UserRow>(
    await fetch(
      new URL(`/admin/tenants/${opts.tenantId}/users/${opts.userId}/status`, opts.baseUrl),
      init(opts, { method: 'PATCH', body }),
    ),
  );
}

// ---- data readiness ------------------------------------------------------

export async function getDataReadiness(opts: ReqOpts & { tenantId?: string }): Promise<DataReadiness> {
  const url = new URL('/admin/data-readiness', opts.baseUrl);
  if (opts.tenantId) url.searchParams.set('tenant_id', opts.tenantId);
  return json<DataReadiness>(await fetch(url, init(opts)));
}

// ---- audit ---------------------------------------------------------------

export interface AuditQuery {
  tenantId?: string;
  from?: string;
  to?: string;
  user_id?: string;
  module?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export interface AuditResult {
  tenant_id: string;
  events: AuditEventRow[];
  count: number;
  limit: number;
  offset: number;
}

export async function queryAudit(opts: ReqOpts & AuditQuery): Promise<AuditResult> {
  const url = new URL('/admin/audit', opts.baseUrl);
  if (opts.tenantId) url.searchParams.set('tenant_id', opts.tenantId);
  if (opts.from) url.searchParams.set('from', opts.from);
  if (opts.to) url.searchParams.set('to', opts.to);
  if (opts.user_id) url.searchParams.set('user_id', opts.user_id);
  if (opts.module) url.searchParams.set('module', opts.module);
  if (opts.action) url.searchParams.set('action', opts.action);
  if (opts.limit != null) url.searchParams.set('limit', String(opts.limit));
  if (opts.offset != null) url.searchParams.set('offset', String(opts.offset));
  return json<AuditResult>(await fetch(url, init(opts)));
}
