# apps/web — Next.js web app (`@seedora/web`)

Next.js 16 App Router shell around the shared UI. A client-only SPA: one route, rendered with `ssr: false`. The server side exists only to proxy Transmission RPC calls.

## What lives where

- `src/app/` — `layout.tsx`, `page.tsx`, `globals.css` (Tailwind `@source` pointing at `packages/shared`)
- `src/lib/SeedoraApp.tsx`, `WebApp.tsx` — bootstrap and app root (web counterpart of `src/renderer/App.tsx`)
- `src/lib/web-api.ts` — `PlatformApi` implementation; `web-storage.ts` — `localStorage` persistence
- `src/lib/server-actions/` — `rpc.ts`, `session.ts`, `geoip.ts`
- `src/lib/i18n.ts` — static locale imports (a new language must be added here by hand)

UI components do not belong here: they go in `packages/shared/src/components`.

## Rules

1. **A server action is a public HTTP endpoint.** Anyone can call it with any arguments. Validate every argument at runtime; never assume the caller is our UI.
2. **Never trust the cookie.** Its content is caller-controlled input: validate it like any other, and never put a secret in it unencrypted.
3. **Outbound requests follow the host policy** (guard not implemented yet: `c07.2`) in `docs/security.md` (default-deny private ranges, `SEEDORA_ALLOW_PRIVATE_HOSTS` opt-in). No new code path that fetches a caller-supplied URL without it.
4. No credentials in logs, error messages or responses.
5. Web has no Electron-only `PlatformApi` methods: provide a browser fallback or hide the feature.
6. Verify UI changes with the `chrome-devtools-web` MCP server against `npm run dev:web` (started by the user), at mobile and desktop widths.

See `docs/security.md` for the known gaps in this directory before touching `server-actions/`.
