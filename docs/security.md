# Security model

This document describes the model **as it is today** and, separately, the known gaps. Status of the web hardening: implemented on branch `chore/repo-cleanup`, pending a final security audit and not yet released. To report a vulnerability, see `SECURITY.md` at the repo root.

## Trust boundaries

| Component | Trust | Notes |
|---|---|---|
| Electron main process | Trusted | Holds credentials, file system and network access |
| Electron renderer | **Untrusted** | Renders daemon-supplied data (torrent, file, tracker, peer names) |
| Next.js server | Trusted | Makes outbound requests on behalf of any visitor |
| Browser (web app) | **Untrusted** | Any client can call any server action with any arguments |
| Transmission daemon | Semi-trusted | User-chosen; its responses are data, never markup or code |

## What is in place

**Electron**

- `contextIsolation: true`, `nodeIntegration: false` (`createWindow` in `src/main/index.ts`).
- The renderer reaches the main process only through `window.api`, defined in `src/preload/preload.ts`.
- Fuses (`forge.config.ts`): `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, cookie encryption on, asar integrity validation on, `OnlyLoadAppFromAsar` on.
- `shell.openExternal` is only called with hardcoded URLs (`src/main/menu.ts`).
- No `child_process`, no remote module, no auto-updater. The remote debugging port exists only in the `start:debug` npm script.
- RPC requests are made from the main process; TLS certificates are verified (no `rejectUnauthorized` override).

**Web** (decisions: [ADR 0002](decisions/0002-web-session-cookie.md) cookie, [0003](decisions/0003-web-outbound-request-policy.md) outbound policy, [0004](decisions/0004-web-server-action-hardening.md) actions, [0005](decisions/0005-web-security-headers.md) headers)

- All RPC traffic goes through server actions; the browser never contacts the daemon.
- **Sealed session cookie.** The active server (host, port, path, TLS flag, credentials) is sealed with `iron-session` (`apps/web/src/lib/server/session-cookie.ts`). It is `httpOnly`, `SameSite=Strict`, named `__Host-seedora-session` and `Secure` in production, with a 4 hour lifetime. A forged, edited or expired cookie reads as "no session". `COOKIE_SECRET` (at least 32 characters) is required in production: the server refuses to start without it (`instrumentation.ts`, `assertServerConfig` in `server/env.ts`), and there is no fallback secret. `COOKIE_SECRET_PREVIOUS` allows rotation. The legacy `seedora_server` base64 cookie is never read and is deleted on the next write or clear. When the cookie is missing or expired, `web-api.ts` re-seals it from `localStorage` and retries once.
- **Host guard (SSRF policy).** Every outbound request goes through `postJson` in `server/outbound.ts`. It resolves the host once, classifies every resolved address (`server/address-policy.ts`), refuses the call if any address is denied, and connects to a validated address only (DNS-rebinding safe). Loopback, private, CGNAT and link-local ranges are denied unless `SEEDORA_ALLOW_PRIVATE_HOSTS=true`; unspecified, multicast, reserved, documentation, transition (NAT64, 6to4, Teredo) and cloud-metadata addresses are always denied. Ports on the WHATWG "bad ports" list are refused. Redirects are not followed, TLS certificates are verified, `HTTP_PROXY` is ignored. `SEEDORA_ALLOWED_HOSTS` can narrow the private-network opt-in to named hosts.
- **Validated actions.** Server actions only export actions, validate every argument with zod (`server/schemas.ts`), accept only an allowlist of RPC methods, take RPC `args` as a bounded JSON string, and cap `geoipLookup` at 512 IPs. Each call has a deadline (8, 15 or 30 s), a response size cap, and byte, concurrency and DNS-lookup limits. Failures return a fixed error code, never `err.message`, addresses or credentials.
- **In-process rate limits** per client, per resolved destination address, and per action (`server/rate-limit.ts`, `server/limits.ts`). See the limits under known gaps.
- **Security headers** (`apps/web/src/lib/security-headers.ts`, applied from `next.config.ts`): CSP, HSTS (production), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, COOP, CORP, `Permissions-Policy`.
- No analytics, no third-party requests. GeoIP lookups use a local database.

**Renderer (both apps)**

- Daemon-supplied strings are rendered as React text. No `dangerouslySetInnerHTML`, `eval` or `new Function`. No links are built from daemon data.

**By design, not a bug**

- The settings UI exposes the daemon's `script-torrent-*` options. Anyone who can use the app with a server's credentials can configure scripts on that daemon — the same power the Transmission RPC gives them directly.

## Known gaps (tracked in beads)

These are confirmed and scheduled. Do not rely on the behaviour below; do not add code that depends on it.

### Web app

The web guard is implemented. What remains:

| Gap | Where | Tracked in |
|---|---|---|
| **Plaintext passwords in `localStorage`**, and in exported config files. Any script running on the origin can read them. The sealed cookie does not change this, because the client keeps its own copy to re-seal the session. | `apps/web/src/lib/web-storage.ts`, export in `ServerSwitcher` / `AppPrefsDialog` | `c07.8` |
| **Rate limits are in memory and per server instance.** On a serverless host, instances are recycled and may run in parallel, so a distributed or patient attacker is only slowed down. The platform-level rule is not configured yet. | `server/rate-limit.ts`, `server/limits.ts` | `c07.18` (Vercel Firewall rule), `46b` (shared-key lockout and destination-bucket drain by third parties) |
| **No per-client limit without a trusted proxy.** Off Vercel, the client IP header is used only when `SEEDORA_TRUST_PROXY_HEADERS=true`. Without it, only the destination, global and shared limits apply. A public instance must set it behind a proxy that overwrites `X-Forwarded-For`. | `server/rate-limit.ts` (`clientKey`) | ADR 0004 section 6 |
| **CSP allows `'unsafe-inline'` scripts** (static policy, so the page stays prerendered). `script-src-attr 'none'` still blocks inline handlers. A nonce-based policy is not evaluated yet. The CSP has not been checked in a browser for violations. | `apps/web/src/lib/security-headers.ts` | `c07.17` (nonce CSP), `c07.7` (headers, in progress) |
| **Next.js is behind the fixed version** for the Server Action / RSC denial-of-service advisories. | `apps/web/package.json` | `099` |
| **Unverified platform behaviour.** That Vercel overwrites `x-vercel-forwarded-for` and `x-forwarded-for` (the client key depends on it) and that the function duration limit exceeds the 30 s deadline have not been confirmed. | `server/rate-limit.ts`, `server/transmission.ts` | `c07.10`, `c07.18` |
| **Untested: pinned HTTPS connections.** Connecting to a validated IP while keeping SNI and certificate checks on the hostname follows the documented `https.request` behaviour but has no test against a real TLS server. | `server/outbound.ts` | not tracked yet |
| **Residual SSRF surface.** The public deployment can still send JSON POST requests to public hosts on allowed ports. Rate limits bound the volume. Daemons reachable only through NAT64 or 6to4 addresses are refused. | ADR 0003 consequences | accepted |
| **Self-hosting over plain HTTP does not work in production.** The `__Host-` cookie requires `Secure`, so run behind a TLS reverse proxy. | `server/session-cookie.ts` | ADR 0002 open question |
| Test coverage of the guard, cookie, schemas, limiter and headers is partial. | `apps/web/src/lib/**` | `c07.3`, `c07.11`, `c07.12`, `c07.13`, `c07.14`, `c07.15` |

**SSRF host policy.** A hosted proxy to a user-supplied host is SSRF by nature, so the server denies by default and self-hosters opt in. Self-hosters who run the web app on the same LAN as their daemon set `SEEDORA_ALLOW_PRIVATE_HOSTS=true`, and should add `SEEDORA_ALLOWED_HOSTS` (see [setup.md](setup.md#environment-variables)). A public deployment must leave the opt-in unset. Cloud metadata addresses stay denied even with the opt-in.

### Electron app

| Gap | Where | Intended fix |
|---|---|---|
| **No sandbox, CSP or navigation guards.** `sandbox` is not set; there is no CSP, `will-navigate` handler, `setWindowOpenHandler` or permission handler. A page the window navigates to keeps the preload and therefore `window.api`. | `src/main/index.ts`, `index.html` | `sandbox: true`, CSP, deny navigation and new windows, single-instance lock |
| **IPC handlers do not validate input** and do not check the sender frame. | `src/main/ipc/*.ts` | Schema validation and sender check on every handler |
| **Arbitrary file read.** `READ_FILE_BASE64` and `CONFIG_IMPORT` (`filePath`) read any path the renderer supplies; `RPC_TORRENT_ADD` reads any absolute path given as `filename` and sends it to the daemon. `DIALOG_OPEN_FILE` forwards renderer-supplied dialog options. | `ipc/config-handlers.ts`, `ipc/rpc-handlers.ts` | Only paths returned by a native dialog (tracked in main) and of the expected type |
| **Plaintext credentials at rest.** Server and proxy passwords are stored as plain JSON with default file permissions. | `src/main/store/config-store.ts` | `safeStorage` encryption with migration, atomic writes, `0600` |
| **`onMenuEvent` has no allowlist.** The renderer can subscribe to any IPC channel name. | `src/preload/preload.ts` | Restrict to the known `menu:*` / tray channels |
| One channel (`tray:toggle-alt-speed`) is a string literal outside `ipc-channels.ts`. | `src/main/index.ts`, `tray.ts` | Move to `IPC` |
| `GrantFileProtocolExtraPrivileges` fuse not disabled; DevTools reachable from the production View menu. | `forge.config.ts`, `src/main/menu.ts` | Disable both |
| Imported server and preference objects are stored without validation. | `CONFIG_IMPORT` handler | Schema validation |

### Repository

- A localhost development TLS key pair is tracked under `apps/web/certificates/`. It protects nothing but local dev; it is untracked and ignored (`.gitignore`); it remains in the public git history.

## Rules for new code

1. The renderer and the browser are untrusted. Validate every IPC argument and every server-action argument at runtime.
2. A server action is a public HTTP endpoint. Never assume it is called by our UI or with our cookie.
3. Never read a file path, open a URL or contact a host that came from the renderer or the browser without checking it against what the user explicitly chose.
4. Credentials never go into logs, error messages, exports by default, or anything unencrypted on disk or in a cookie.
5. Daemon-supplied strings are rendered as text only.
