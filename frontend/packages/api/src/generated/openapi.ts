// Placeholder. Run `pnpm gen:api -- --url http://localhost:8000/openapi.json`
// (or pass a local --file) to overwrite this with the real, typed schema.
// Until that runs, the client compiles against the loose ``paths`` interface
// below — once generated the strict shapes replace it.

export interface paths {
  [path: string]: unknown;
}

export type components = Record<string, never>;
export type webhooks = Record<string, never>;
export type operations = Record<string, never>;
