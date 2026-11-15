# Security model

This document describes the model **as it is today** and, separately, the known gaps. To report a vulnerability, see `SECURITY.md` at the repo root.

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

**Web**

- All RPC traffic goes through server actions; the browser never contacts the daemon.
- The active-server cookie is `httpOnly`, `sameSite: strict`, and `secure` in production.
- No analytics, no third-party requests. GeoIP lookups use a local database.

**Renderer (both apps)**

- Daemon-supplied strings are rendered as React text. No `dangerouslySetInnerHTML`, `eval` or `new Function`. No links are built from daemon data.

**By design, not a bug**

- The settings UI exposes the daemon's `script-torrent-*` options. Anyone who can use the app with a server's credentials can configure scripts on that daemon — the same power the Transmission RPC gives them directly.

## Known gaps (tracked in beads)

These are confirmed and scheduled. Do not rely on the behaviour below; do not add code that depends on it.

### Web app

| Gap | Where | Intended fix |
|---|---|---|
| **SSRF.** `rpcRequest`, `testServerConnection` and `setActiveServerCookie` are public server actions that make the server POST to a caller-chosen host, port and path, with no validation, allowlist, timeout or rate limit. | `apps/web/src/lib/server-actions/rpc.ts`, `session.ts` | Input validation, RPC method allowlist, timeout, rate limit, and the host policy below |
| **Credentials in an unprotected cookie.** The active server, including the Transmission password, is stored as base64 JSON — neither encrypted nor signed. `COOKIE_SECRET` has a hardcoded fallback and is never used. | `server-actions/session.ts` | Encrypted, signed cookie (`iron-session` is already a dependency); `COOKIE_SECRET` mandatory in production |
| **No security headers.** No CSP, HSTS, `X-Frame-Options` or `Referrer-Policy`. | `apps/web/next.config.ts` | `headers()` config |
| Plaintext passwords in `localStorage`, and in exported config files. | `apps/web/src/lib/web-storage.ts`, export in `ServerSwitcher` / `AppPrefsDialog` | Explicit warning; exports exclude passwords by default |
| Unbounded input to the GeoIP action. | `server-actions/geoip.ts` | Size cap |

**SSRF host policy (design decision).** A hosted proxy to a user-supplied host is SSRF by nature, so the fix is a policy, not a patch: the server **denies by default** loopback, private (RFC 1918 / ULA), link-local and cloud-metadata addresses, checked after DNS resolution. Self-hosters who run the web app on the same LAN as their daemon opt in with `SEEDORA_ALLOW_PRIVATE_HOSTS=true`. A public deployment must leave it unset.

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

- A localhost development TLS key pair is tracked under `apps/web/certificates/`. It protects nothing but local dev; it is being removed from the tree and ignored.

## Rules for new code

1. The renderer and the browser are untrusted. Validate every IPC argument and every server-action argument at runtime.
2. A server action is a public HTTP endpoint. Never assume it is called by our UI or with our cookie.
3. Never read a file path, open a URL or contact a host that came from the renderer or the browser without checking it against what the user explicitly chose.
4. Credentials never go into logs, error messages, exports by default, or anything unencrypted on disk or in a cookie.
5. Daemon-supplied strings are rendered as text only.
