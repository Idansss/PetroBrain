# PetroBrain frontend monorepo (B1 scaffold)

pnpm workspaces. Three apps share a typed API client, a design system, and
shared domain types.

## Layout

```
apps/
  web/      Next.js 14 office app (chat, MRV dashboard, documents)
  admin/    Next.js 14 admin console (tenants, audit, data readiness)
  field/    Expo + React Native field app (Ask, PTW, Calcs, Logs)
packages/
  types/    shared TypeScript domain types
  api/      typed REST client generated from FastAPI's /openapi.json
  ui/       design system: tokens + primitives + Storybook + Vitest
```

## Setup

```bash
corepack enable                                # provides pnpm
pnpm install                                   # one shot across all workspaces

# Generate the API client from a running backend (or a local copy of openapi.json)
pnpm gen:api -- --url http://localhost:8000/openapi.json
# or
pnpm gen:api -- --file ../PetroBrain/openapi.json
```

## Daily commands

| Command                | What it does                                          |
|------------------------|-------------------------------------------------------|
| `pnpm dev:web`         | Next.js dev server for the office app                 |
| `pnpm dev:admin`       | Next.js dev server for the admin console              |
| `pnpm dev:field`       | Expo dev server for the field app                     |
| `pnpm storybook`       | Storybook for the design system primitives            |
| `pnpm typecheck`       | TS strict mode across every workspace                 |
| `pnpm lint`            | Per-workspace ESLint                                  |
| `pnpm test`            | Vitest / RTL where present                            |
| `pnpm build`           | Production build of every workspace                   |

## Hard rules (mirror of the frontend master prompt)

1. Calculations come from the backend. Never reimplement calc/RAG/guardrails in the client.
2. Citations are not optional decoration. Render them on every safety-critical answer.
3. The field app must work offline against its local cache. Show network state clearly.
4. Strong typing throughout (TS strict). No `any` unless justified at a system boundary.
5. Accessibility: AA color contrast, keyboard nav, screen-reader labels, min 56 px tap targets on field.
6. No client-side secrets.

## What's in this commit

B1 is the scaffold only. Subsequent tasks (B2–B8) wire the surfaces.
