# apps/web — Next.js web app (`@seedora/web`)

Next.js 16 App Router shell around the shared UI. A client-only SPA: one route, rendered with `ssr: false`. The server side exists only to proxy Transmission RPC calls.

## What lives where

- `src/app/` — `layout.tsx`, `page.tsx`, `globals.css` (Tailwind `@source` pointing at `packages/shared`)
- `src/lib/SeedoraApp.tsx`, `WebApp.tsx` — bootstrap and app root (web counterpart of `src/renderer/App.tsx`)
- `src/lib/web-api.ts` — `PlatformApi` implementation; `web-storage.ts` — `localStorage` persistence
- `src/lib/server-actions/` — `rpc.ts`, `session.ts`, `geoip.ts`: thin actions only
- `src/lib/server/` — the logic behind them: `env.ts`, `session-cookie.ts`, `schemas.ts`, `address-policy.ts`, `outbound.ts`, `transmission.ts`, `rate-limit.ts`, `limits.ts`, `errors.ts`
- `src/lib/i18n.ts` — static locale imports (a new language must be added here by hand)

UI components do not belong here: they go in `packages/shared/src/components`.

## Rules

1. **A server action is a public HTTP endpoint.** Anyone can call it with any arguments. Validate every argument at runtime; never assume the caller is our UI.
2. **Never trust the cookie.** It is sealed (`iron-session`), but anyone can obtain a valid cookie for a target of their choice: validate its content after unsealing, and never put a secret in it unsealed.
3. **Every outbound request goes through `postJson`** in `src/lib/server/outbound.ts` (the host guard, `docs/decisions/0003-web-outbound-request-policy.md`: default-deny private ranges, `SEEDORA_ALLOW_PRIVATE_HOSTS` opt-in). Never call `fetch`, `http.request` or `https.request` with a caller-influenced destination elsewhere.
3a. **`'use server'` files export only actions.** Helpers go in `src/lib/server/` as plain modules; an exported helper in an action file becomes a public endpoint. A new RPC method used by `web-api.ts` must be added to the allowlist in `server/schemas.ts`.
4. No credentials in logs, error messages or responses: failures return a fixed code from `server/errors.ts`.
5. Web has no Electron-only `PlatformApi` methods: provide a browser fallback or hide the feature.
6. Verify UI changes with the `chrome-devtools-web` MCP server against `npm run dev:web` (the main session starts and stops it), at mobile and desktop widths.

See `docs/security.md` for the known gaps in this directory before touching `server-actions/`.
