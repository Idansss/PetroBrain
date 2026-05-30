import { describe, expect, it } from 'vitest';

import { decodeAdminPrincipal } from '../session/jwt.js';

function makeToken(claims: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  return `${header}.${payload}.sig`;
}

function b64url(s: string): string {
  // happy-dom test env has Buffer; encode and strip padding
  return Buffer.from(s, 'utf8').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

describe('decodeAdminPrincipal', () => {
  it('decodes platform_admin claims', () => {
    const token = makeToken({
      tenant_id: '__platform__',
      user_id: 'p',
      role: 'platform_admin',
      allowed_assets: ['*'],
    });
    const principal = decodeAdminPrincipal(token);
    expect(principal).toEqual({
      tenantId: '__platform__',
      userId: 'p',
      role: 'platform_admin',
      allowedAssets: ['*'],
    });
  });

  it('decodes regular admin claims', () => {
    const token = makeToken({
      tenant_id: 'tenant-a',
      user_id: 'a',
      role: 'admin',
      allowed_assets: [],
    });
    expect(decodeAdminPrincipal(token)?.role).toBe('admin');
  });

  it.each([
    [null, null],
    ['not-a-jwt', null],
    [makeToken({ user_id: 'x', role: 'admin' }), null],   // missing tenant_id
    [makeToken({ tenant_id: 't', user_id: 'x', role: 'intruder' }), null],
  ])('returns null for invalid input %#', (input, expected) => {
    expect(decodeAdminPrincipal(input as string | null)).toBe(expected);
  });
});
