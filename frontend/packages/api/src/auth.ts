import type { Middleware } from 'openapi-fetch';

/**
 * Resolves a JWT for the current user. May be sync (in-memory store) or
 * async (silent refresh, IndexedDB on the field app). Returning ``null``
 * skips the Authorization header so unauth endpoints (eg. health) still
 * work.
 */
export type AuthTokenProvider = () => string | null | Promise<string | null>;

export function buildAuthMiddleware(provider: AuthTokenProvider): Middleware {
  return {
    async onRequest({ request }) {
      const token = await provider();
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      return request;
    },
  };
}
