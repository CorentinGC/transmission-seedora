# apps/web — Next.js web app (`@seedora/web`)

Next.js 16 App Router shell around the shared UI. A client-only SPA: one route, rendered with `ssr: false`. The server side exists only to proxy Transmission RPC calls.

## What lives where

- `src/app/` — `layout.tsx` (exports `maxDuration = 60` for the Server Actions: `page.tsx` is a client component), `error.tsx`, `global-error.tsx`, `page.tsx`, `globals.css` (Tailwind `@source` pointing at `packages/shared`)
- `src/lib/SeedoraApp.tsx`, `WebApp.tsx` — bootstrap and app root (web counterpart of `src/renderer/App.tsx`)
- `src/lib/web-api.ts` — `PlatformApi` implementation (config export omits passwords unless `includePasswords: true`); `web-storage.ts` — `localStorage` persistence; `config-import-schema.ts` — backup validation; `session-recovery.ts` — re-seal the cookie once on `NO_SESSION`; `server-target.ts` — client-safe target payload helpers; `initial-server.ts` — which server to reconnect to at startup
- `src/lib/security-headers.ts` — pure builder of the response headers, applied in `next.config.ts` (ADR 0005, 0007)
- `src/instrumentation.ts` — boot-time config check (`assertServerConfig`)
- `src/lib/server-actions/` — `rpc.ts`, `session.ts`, `geoip.ts`: thin actions only
- `src/lib/server/` — the logic behind them: `env.ts`, `session-cookie.ts`, `active-session.ts`, `schemas.ts`, `address-policy.ts`, `resolver.ts`, `outbound.ts`, `outbound-limits.ts`, `transmission.ts`, `rate-limit.ts`, `limits.ts`, `action-error.ts`, `errors.ts`
- `src/lib/i18n.ts` — static locale imports (a new language must be added here by hand)

UI components do not belong here: they go in `packages/shared/src/components`.

## Rules

1. **A server action is a public HTTP endpoint.** Anyone can call it with any arguments. Validate every argument at runtime; never assume the caller is our UI.
2. **Never trust the cookie.** It is sealed (`iron-session`), but anyone can obtain a valid cookie for a target of their choice: validate its content after unsealing, and never put a secret in it unsealed.
3. **Every outbound request goes through `postJson`** in `src/lib/server/outbound.ts` (the host guard, `docs/decisions/0003-web-outbound-request-policy.md`: default-deny private ranges, `SEEDORA_ALLOW_PRIVATE_HOSTS` opt-in). Never call `fetch`, `http.request` or `https.request` with a caller-influenced destination elsewhere.
3a. **`'use server'` files export only actions.** Helpers go in `src/lib/server/` as plain modules; an exported helper in an action file becomes a public endpoint. A new RPC method used by `web-api.ts` must be added to the allowlist in `server/schemas.ts`.
3b. **Rate limits need an identity.** A bucket shared by every caller lets a third party lock the owner out: per-client buckets of local-only work are skipped without a trusted client key (`server/limits.ts`, ADR 0004 section 6).
4. No credentials in logs, error messages or responses: failures return a fixed code from `server/errors.ts`.
5. Web has no Electron-only `PlatformApi` methods: provide a browser fallback or hide the feature.
6. Verify UI changes with the `chrome-devtools-web` MCP server against `npm run dev:web` (the main session starts and stops it), at mobile and desktop widths.

Env vars: `.env.example`. See `docs/security.md` for the model and the remaining gaps before touching `server-actions/`.
