/**
 * Decode-only JWT (signature verification is server-side on every
 * request). Adds platform_admin to the role union vs the web/field
 * decoders so role gates can route correctly here.
 */
export type AdminRole = 'platform_admin' | 'admin' | 'engineer' | 'field' | 'hse';

export interface AdminPrincipal {
  tenantId: string;
  userId: string;
  role: AdminRole;
  allowedAssets: string[];
}

export function decodeAdminPrincipal(token: string | null): AdminPrincipal | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(b64urlDecode(parts[1]!));
    if (typeof payload !== 'object' || payload === null) return null;
    const tenantId = stringClaim(payload, 'tenant_id');
    const userId = stringClaim(payload, 'user_id') ?? stringClaim(payload, 'sub');
    const role = stringClaim(payload, 'role');
    const allowed = (payload as Record<string, unknown>).allowed_assets;
    if (!tenantId || !userId || !isRole(role)) return null;
    return {
      tenantId,
      userId,
      role,
      allowedAssets: Array.isArray(allowed)
        ? allowed.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

function stringClaim(obj: unknown, key: string): string | null {
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRole(value: string | null): value is AdminRole {
  return (
    value === 'platform_admin' ||
    value === 'admin' ||
    value === 'engineer' ||
    value === 'field' ||
    value === 'hse'
  );
}

function b64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  if (typeof atob === 'function') return atob(padded);
  return Buffer.from(padded, 'base64').toString('binary');
}
