# 0002 — Web active-server cookie: sealed with iron-session

- **Status:** Accepted (2026-11-15, recommendation adopted by the maintainer's delegation)
- **Date:** 2026-11-15
- **Issue:** seedora-transmission-c07.1

## Context

The web app proxies Transmission RPC through Next.js server actions. The server needs the active server's address and credentials on every call, and it is stateless (Vercel serverless), so they travel in a cookie.

Today (`apps/web/src/lib/server-actions/session.ts`) that cookie, `seedora_server`, is base64 JSON holding host, port, path, TLS flag, username and **password** — neither encrypted nor signed. `COOKIE_SECRET` has a hardcoded fallback and is never used. In addition, `getActiveServerFromCookie` is an exported async function in a `'use server'` file, which makes it a callable server action: once the cookie is encrypted, it would return the decrypted password to any script running in the page.

Facts checked in the repo:

- `iron-session` 8.0.4 is already a dependency of `apps/web`. It exports pure `sealData` / `unsealData` functions; passwords must be at least 32 characters; a password map `{ id: secret }` allows rotation, and `sealData` always uses the **highest numeric id**. `unsealData` returns `{}` (does not throw) for a bad, expired or unknown-key seal. Cookies above 4096 bytes are rejected.
- The client re-seals the cookie on every page load: `activeServerId` is not persisted in the store, so `WebApp` calls `setActiveServer(servers[0].id)` on startup, which calls the `serverSetActive` action. Mid-session there is no recovery: a missing or unreadable cookie surfaces as `No active server configured`.
- `next build` runs with `NODE_ENV=production`, so a secret check at module top level would break builds that have no secret (CI, forks).

## Decision

1. **Seal with iron-session.** The cookie value is `sealData(payload, { password: { [currentId]: current }, ttl })`; reading uses `unsealData(value, { password: { [currentId]: current, [previousId]: previous } })` and then validates the result with the server-target schema (ADR 0004). An empty or invalid result means "no session". We use the pure functions with `cookies()` from `next/headers`, not `getIronSession`, so sealing and unsealing are unit-testable without mocking Next.

2. **Secrets and rotation.**
   - `COOKIE_SECRET` (required in production, at least 32 characters, e.g. `openssl rand -base64 32`).
   - `COOKIE_SECRET_PREVIOUS` (optional): the secret being rotated out, accepted for reading only.
   - Each secret's iron-session id is derived from the secret itself (a positive 31-bit integer from the first bytes of its SHA-256), so ids never need to be managed by hand. Because sealing passes a single-entry map, "highest id wins" never applies. This was checked against iron-session 8.0.4: a seal made with `{ idA: a }` unseals with `{ idA: a, idB: b }`, and returns `{}` with `{ idB: b }` only or when tampered.
   - Rotation procedure: set `COOKIE_SECRET_PREVIOUS` to the old value and `COOKIE_SECRET` to a new one, deploy, remove `COOKIE_SECRET_PREVIOUS` after one TTL (7 days). Even an abrupt rotation only costs a silent re-seal (point 6).

3. **No fallback secret, fail closed.** A single module, `apps/web/src/lib/server/env.ts`, reads the secrets **lazily** (never at module top level).
   - Production (`NODE_ENV=production`): a missing or short secret throws, and the action returns a generic server-configuration error. No literal secret exists anywhere in the code.
   - `apps/web/src/instrumentation.ts` `register()` runs the same check at server start, unless `NEXT_PHASE` is the production-build phase, so a misconfigured deployment fails loudly at boot instead of on the first request.
   - Development and test: if unset, a random 32-byte secret is generated once per process and kept on `globalThis` so it survives HMR, with a single console warning. Cookies do not survive a dev-server restart; that is acceptable.

4. **Cookie flags.**

   | Attribute | Production | Development |
   |---|---|---|
   | Name | `__Host-seedora-session` | `seedora-session` |
   | `Secure` | yes (required by the `__Host-` prefix) | no |
   | `HttpOnly` | yes | yes |
   | `SameSite` | `Strict` | `Strict` |
   | `Path` | `/` | `/` |
   | `Domain` | none (host-only, required by `__Host-`) | none |
   | `Max-Age` | 7 days minus 60 s | same |

   The seal TTL is 7 days and is enforced cryptographically, independently of `Max-Age`. The `__Host-` prefix means a sibling site, such as the future landing page on `seedora.app`, cannot set or overwrite the cookie of `app.seedora.app`.

5. **What is stored — and nothing else.**

   ```ts
   { v: 1, host: string, port: number, path: string, useSSL: boolean, username?: string, password?: string }
   ```

   No server `id` or `name` and no proxy fields (proxies are not supported on web). `v` versions the payload for future migrations: an unknown `v` reads as "no session".

6. **Migration of the legacy base64 cookie, and recovery.**
   - The new cookie has a new name, so a legacy `seedora_server` value is never parsed. Each write or clear of the session also deletes `seedora_server`. A server action is a context where cookies can be modified, so this is allowed.
   - Server actions return a stable error code `NO_SESSION` when the cookie is missing, unreadable or expired (ADR 0004).
   - `apps/web/src/lib/web-api.ts` handles `NO_SESSION` from any RPC call by re-sealing from `localStorage` (`serverSetActive(getActiveServerId())`) and retrying the call **once**. This covers the first load after deployment, rotation, expiry and a cleared cookie. Users never have to re-enter anything, and the server never accepts the unprotected format.

7. **Only actions are exported from `'use server'` files.** The cookie reader becomes a plain module (`apps/web/src/lib/server/session-cookie.ts`). `server-actions/session.ts` exports only `setActiveServerCookie(input)` and `clearServerCookie()`. The same rule applies to every helper in ADRs 0003 and 0004.

## Open question

`Secure` + `__Host-` means a production build served over plain `http://` on a LAN never receives the cookie, so the app cannot connect. The current code already sets `secure` in production, so this is not a regression, but self-hosting on a LAN is a supported use case (ADR 0003).

**Recommendation:** no opt-out. Self-hosters run behind a TLS reverse proxy, or run the dev build. The cookie carries the daemon password, so the transport should be encrypted anyway. The alternative is a `SEEDORA_INSECURE_COOKIE=true` opt-in that drops `Secure` and the prefix.

## Alternatives considered

- **`getIronSession`**: one password map for both seal and unseal, so rotation with derived ids would not work. It also needs `next/headers` mocked in every test.
- **Server-side session store (KV/Redis) holding only an opaque id**: credentials would never leave the server, but this adds a paid stateful dependency to a stateless proxy, and the credentials are already in the browser's `localStorage` (c07.8).
- **Accepting and upgrading the legacy cookie on read**: it would keep trusting unsigned, caller-forged input for a transition period. Client re-sealing makes it unnecessary.
- **Hand-rolled AES-GCM with `node:crypto`**: iron-session is already a dependency, audited and versioned. Rolling our own means owning the crypto.
- **Hardcoded dev fallback secret**: the same class of bug as today; a deployment that forgets the variable would silently run with a public key.

## Consequences

- The cookie is unreadable and tamper-evident without the secret. A forged or edited cookie reads as "no session".
- Deployments must set `COOKIE_SECRET`. Vercel environment variables and the self-hosting docs (`docs/setup.md`) must say so.
- Sealing does not stop an attacker from obtaining a valid cookie: anyone can call `setActiveServerCookie` with a target they choose. **The SSRF guard (ADR 0003) and validation (ADR 0004) are therefore enforced on every outbound request, not at cookie-write time only.**
- The `NO_SESSION` retry path in `web-api.ts` must be maintained and tested.
