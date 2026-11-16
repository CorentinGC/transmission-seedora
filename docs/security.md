# Security model

This document describes the model **as it is today** and, separately, the known gaps. Status of the web and Electron hardening: implemented on branch `chore/repo-cleanup`, pending a final security audit and not yet released (the branch is not pushed). To report a vulnerability, see `SECURITY.md` at the repo root.

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

- Window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `devTools` only when unpackaged (`createWindow` in `src/main/index.ts`).
- **Renderer origin.** The packaged renderer is served from the privileged `app://seedora` scheme, not from `file://` ([ADR 0006](decisions/0006-packaged-renderer-app-scheme.md)). `src/main/security/app-protocol.ts` serves only allow-listed file types under the renderer build directory, GET and HEAD only (other methods get 405), after a realpath containment check; everything else is an opaque 404. The scheme is registered without `corsEnabled`, `bypassCSP`, `allowServiceWorkers` or `stream` (`security/app-scheme.ts`). Verified in a packaged build: `fetch('file://...')` is blocked, path traversal returns 404, `POST` returns 405.
- **CSP.** A `<meta http-equiv>` policy is injected into `index.html` at build time (`cspPlugin` in `vite.renderer.config.ts`, policy from `security/csp.ts`). Production: `default-src 'self'`, `script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-src 'none'`. `style-src` keeps `'unsafe-inline'`. The dev policy adds `'unsafe-inline'` scripts and the Vite dev server and HMR origins.
- **Navigation and permissions** (`security/window-guards.ts`): `will-navigate` and `will-redirect` are blocked unless the target is the app's own origin, `setWindowOpenHandler` denies every new window, `<webview>` is refused, and every permission request, permission check and device permission is denied except `clipboard-sanitized-write` for the app's own page. Packaged builds close DevTools if they open. Trust is by origin (`app://seedora`, or the dev server in development); a `file:` URL is never trusted (`security/sender.ts`).
- **Single instance.** `app.requestSingleInstanceLock()` is claimed before any handler is registered; a second launch quits and focuses the existing window.
- **IPC.** Every channel goes through `security/ipc-guard.ts`: sender check (top-level frame, trusted origin) then zod validation of the arguments (`security/schemas.ts`); failures return `Invalid request` or `Untrusted sender` and run no handler code. A handler that throws returns a generic `Request failed`. Server `host` must be a hostname, IPv4 or `[IPv6]` literal and `path` must match `^/[A-Za-z0-9._~/-]*$`, since both are interpolated into the RPC URL. Patches never carry `undefined` keys. Imported servers and preferences are validated (`importDataSchema`). The web `configImport` (`apps/web/src/lib/config-import-schema.ts`) mirrors it: whole payload validated before anything is written (failure returns `Import failed: invalid file`), servers are add-only with duplicates (host+port+path) skipped, fresh ids, `allowSelfSigned` stripped, preferences a partial patch without `watchFolder`; the active server and the sealed cookie are never touched.
- **Approved paths.** Files are read only if their path was returned by a dialog that main opened (`security/approved-paths.ts`), and only for the kind of dialog that produced it: `torrent`, `json`, `directory`, `watch-folder`. Reads open the file `O_RDONLY|O_NOFOLLOW`, `fstat` and read on one descriptor, with a size cap (10 MB for `.torrent`, 5 MB for backup JSON). `READ_FILE_BASE64`, `CONFIG_IMPORT` and local-file `torrent-add` go through it, and an unapproved path is refused (verified in the packaged build). `watchFolder` in `PREFS_SET` needs a `watch-folder` approval; a backup import never sets it.
- **Preload.** `window.api.onMenuEvent` only subscribes to channels in `RENDERER_EVENT_CHANNELS` (`src/shared/ipc-channels.ts`); any other channel name gets a no-op unsubscribe.
- **Watch folder** (`security/watch-folder.ts`, `src/main/watcher.ts`): the stored folder is revalidated at startup, symlinks are skipped, files over 10 MB are skipped, and reads use the same descriptor-based reader.
- **Credentials at rest** (`src/main/store/config-store.ts`, `secret-crypto.ts`, `atomic-write.ts`). Server and proxy passwords are encrypted with the asynchronous Electron `safeStorage` API (`encryptStringAsync` / `decryptStringAsync`; same OS keys and ciphertext format as the removed sync API, so existing `config.json` files keep working) and stored as `passwordEnc` / `proxyPasswordEnc`. On Linux the `basic_text` backend (a hard-coded key) does not count as available. When no secret store exists, a new password is kept in cleartext in `config.json` and `CONFIG_SECRET_STORAGE` lets the UI warn the user (`ServerFormDialog`, key `server.secretStorageUnencrypted`); cleartext left by an older version is encrypted at startup once a store is available (`migrateLegacySecrets`). If a secret store exists but encrypting fails, the write is refused rather than falling back to cleartext. Decrypted passwords are held in main-process memory after startup (`configStore.init()`). A password that cannot be decrypted (other user or machine, locked keychain) is kept on disk and the user is told which servers to re-enter at startup. `config.json` is written atomically (temp file created with mode `0600`, `fsync`, rename), so a crash leaves the old or the new file.
- **Corrupt or unreadable config.** An invalid `config.json` is moved aside to `config.json.corrupt-<timestamp>` (mode `0600`) and the app starts with defaults; if the file cannot be moved, or exists but cannot be read, writes are disabled (`ConfigStoreError`) so the existing file is never overwritten. The user gets a native error dialog at startup (`reportConfigLoadProblem` in `src/main/index.ts`).
- **Passwords never reach the renderer.** `SERVER_LIST`, `SERVER_ADD` and the other server calls return `toPublicServer` objects: no `password` or `proxyPassword`, only the `hasPassword` / `hasProxyPassword` flags. An update with an empty password keeps the stored one; `clearPassword` / `clearProxyPassword` remove it explicitly.
- **Stored-credential reuse rule** (`security/server-credentials.ts`). A stored password is used by `SERVER_TEST` (which takes a saved server by `id`) only if the endpoint (host, port, path, TLS) is unchanged and `allowSelfSigned` was not switched on; the stored proxy password follows only an unchanged proxy (type, host, port, username). `updateServer` drops a stored password when the endpoint or proxy it belongs to changes, unless the same patch supplies a new one. Connection-test errors go through `rpc/to-ipc-error.ts`: an `RpcError` carries a credential-free message and a code, any other error becomes `Request failed`.
- **Script settings need confirmation** (`security/script-guard.ts`, `ipc/script-confirm-dialog.ts`, `RPC_SESSION_SET` in `ipc/rpc-handlers.ts`). A `session-set` that changes any of the six `script-torrent-*` keys (either spelling) is held until the user approves it in a native dialog (default button: cancel) that shows the server and each key and value, with the script filename whenever a script is enabled. Values already equal to the daemon's are not asked about; if the current values cannot be read, the change is asked about. The active client is captured once for the check and the write, so switching server in between cannot redirect the write. The web app has no equivalent confirmation.
- **Export with passwords.** `CONFIG_EXPORT` without `includePasswords` returns the data with usernames but no passwords. With it, main shows a native confirmation, opens the save dialog itself and writes the file (`writeFileAtomic`); the secrets never cross IPC and the renderer gets only `success`. Declining returns `code: 'CANCELLED'`.
- **Launch targets** (`src/main/launch/`). `magnet:` links and `.torrent` files opened through the OS (macOS `open-url` / `open-file`, argv on Windows and Linux, `second-instance` forwarding) are validated by `launch-targets.ts`: a well-formed magnet URI with an `xt=urn:btih` or `urn:btmh` hash, or a path ending in `.torrent`; flags, other schemes and other files are ignored, and on Windows a UNC or device path (two leading slashes) is refused. A `.torrent` path is then registered in the approved-path registry as kind `torrent`, so it is read through the same descriptor-based reader as a dialog selection. Targets are held in a bounded queue (`launch-queue.ts`) until the renderer pulls them with `LAUNCH_TAKE`. In a packaged build, Seedora registers itself for `magnet:` only when no other application handles it.
- **Main-process i18n.** The native menu, tray and native dialogs read the `native` section of the shared locale files (`src/main/i18n/main-i18n.ts`); the language follows the `language` preference.
- Fuses (`src/main/security/fuses.ts`, applied by `forge.config.ts`): `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, cookie encryption on, asar integrity validation on, `OnlyLoadAppFromAsar` on, `GrantFileProtocolExtraPrivileges` off. A test pins the map.
- DevTools are available only in unpackaged builds; the View menu item is hidden when packaged (`src/main/menu.ts`).
- `shell.openExternal` is only called with hardcoded URLs (`src/main/menu.ts`).
- No `child_process`, no remote module, no auto-updater. The remote debugging port exists only in the `start:debug` npm script.
- RPC requests are made from the main process; TLS certificates and host names are verified by default. A per-server opt-in `allowSelfSigned` (HTTPS only, exact `true`) disables certificate and hostname verification for that server only; imported backups never carry it (stripped in `importedServerSchema`). RPC response bodies are capped at 8 MiB and daemon-supplied status text is sanitised before it reaches an error message.

**Web** (decisions: [ADR 0002](decisions/0002-web-session-cookie.md) cookie, [0003](decisions/0003-web-outbound-request-policy.md) outbound policy, [0004](decisions/0004-web-server-action-hardening.md) actions, [0005](decisions/0005-web-security-headers.md) headers)

- All RPC traffic goes through server actions; the browser never contacts the daemon.
- **Sealed session cookie.** The active server (host, port, path, TLS flag, credentials) is sealed with `iron-session` (`apps/web/src/lib/server/session-cookie.ts`). It is `httpOnly`, `SameSite=Strict`, named `__Host-seedora-session` and `Secure` in production, with a 4 hour lifetime. A forged, edited or expired cookie reads as "no session". `COOKIE_SECRET` (at least 32 characters) is required in production: the server refuses to start without it (`instrumentation.ts`, `assertServerConfig` in `server/env.ts`), and there is no fallback secret. `COOKIE_SECRET_PREVIOUS` allows rotation. The legacy `seedora_server` base64 cookie is never read and is deleted on the next write or clear. When the cookie is missing or expired, `web-api.ts` re-seals it from `localStorage` and retries once.
- **Host guard (SSRF policy).** Every outbound request goes through `postJson` in `server/outbound.ts`. It resolves the host once, classifies every resolved address (`server/address-policy.ts`), refuses the call if any address is denied, and connects to a validated address only (DNS-rebinding safe). Loopback, private, CGNAT and link-local ranges are denied unless `SEEDORA_ALLOW_PRIVATE_HOSTS=true`; unspecified, multicast, reserved, documentation, transition (NAT64, 6to4, Teredo) and cloud-metadata addresses are always denied. Ports on the WHATWG "bad ports" list are refused. Redirects are not followed, TLS certificates are verified by default, `HTTP_PROXY` is ignored. `SEEDORA_ALLOWED_HOSTS` can narrow the private-network opt-in to named hosts.
- **Self-signed TLS is an explicit per-server opt-in.** Certificates are verified by default. A server marked `allowSelfSigned` skips certificate and hostname verification for that server only (`server/outbound.ts`); the address guard, pinning and limits still apply in full. The flag travels in the validated target and the sealed cookie. See ADR 0003 section 4.
- **Validated actions.** Server actions only export actions, validate every argument with zod (`server/schemas.ts`), accept only an allowlist of RPC methods, take RPC `args` as a bounded JSON string, and cap `geoipLookup` at 512 IPs. Each call has a deadline (8, 15 or 30 s), a response size cap, and byte, concurrency and DNS-lookup limits. Failures return a fixed error code, never `err.message`, addresses or credentials.
- **In-process rate limits** per client, per resolved destination address, and per action (`server/rate-limit.ts`, `server/limits.ts`). See the limits under known gaps.
- **Security headers** (`apps/web/src/lib/security-headers.ts`, applied from `next.config.ts`): CSP, HSTS (production), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, COOP, CORP, `Permissions-Policy`.
- No analytics, no third-party requests. GeoIP lookups use a local database.

**Renderer (both apps)**

- Daemon-supplied strings are rendered as React text. No `dangerouslySetInnerHTML`, `eval` or `new Function`. No links are built from daemon data.

**By design, not a bug**

- The settings UI exposes the daemon's `script-torrent-*` options. Anyone who can use the app with a server's credentials can configure scripts on that daemon — the same power the Transmission RPC gives them directly. The desktop app asks for confirmation before changing them (see above); the web app does not.

## Known gaps (tracked in beads)

These are confirmed and scheduled. Do not rely on the behaviour below; do not add code that depends on it.

### Web app

The web guard is implemented. What remains:

| Gap | Where | Tracked in |
|---|---|---|
| **Plaintext passwords in `localStorage`.** Any script running on the origin can read them; the sealed cookie does not change this, because the client keeps its own copy to re-seal the session. Mitigated: the web `configExport` omits server and proxy passwords unless the caller passes `includePasswords: true` (export flow in `packages/shared/src/lib/config-export.ts`; its UI was not verified in a browser). The web app also does not drop a stored password when a server's host changes: this is deliberate, the storage is client-local and the password is only ever sent with that browser's own requests, but it differs from Electron. | `apps/web/src/lib/web-storage.ts`, `web-api.ts` (`configExport`, `mergeServerUpdate`) | `c07.8` (closed; residual risk accepted) |
| **Rate limits are in memory and per server instance.** On a serverless host, instances are recycled and may run in parallel, so a distributed or patient attacker is only slowed down. The platform rule is documented under "Platform rate limiting" below and must be created in the Vercel dashboard or CLI; it is not active until then. A third party can still drain the per-address destination bucket (1800 tokens a minute) of a public daemon address by calling from several IPs, which makes calls to that address answer `RATE_LIMITED` for everyone for a while. This is the cost of bounding amplification toward an address; the platform per-IP rule is the mitigation. | `server/rate-limit.ts`, `server/limits.ts` | `c07.18` (platform rule: needs dashboard action), `46b` (decided, ADR 0004 section 6) |
| **No per-client limit without a trusted proxy.** Off Vercel, the client IP header is used only when `SEEDORA_TRUST_PROXY_HEADERS=true`. Without it there is no identity: the per-client RPC, `setActiveServerCookie` and `geoipLookup` buckets are skipped (a shared bucket would let any third party lock the owner out, `46b`), `testServerConnection` keeps a shared bucket, and the destination, global and lookup limits apply. A public instance must set the variable behind a proxy that overwrites `X-Forwarded-For`, or run on Vercel. | `server/rate-limit.ts` (`clientKey`), `server/limits.ts` | `46b`, ADR 0004 section 6 |
| **CSP allows `'unsafe-inline'` scripts and styles** (static policy, so the page stays prerendered and a precaching service worker would stay compatible; none ships today, bead `0nw`). `script-src-attr 'none'` still blocks inline handlers. A nonce policy was evaluated and not adopted: [ADR 0007](decisions/0007-web-csp-nonce-evaluation.md) gives the reasons and the conditions to revisit. The header values are pinned by unit tests; the page has not been loaded in a browser with the final policy to look for violations. | `apps/web/src/lib/security-headers.ts` | `c07.17` (decided), `c07.7` |
| **Unverified platform behaviour.** Vercel's documentation states that it overwrites `x-forwarded-for` (and sets the identical `x-vercel-forwarded-for`) and does not forward external IPs, which is what the client key relies on; this was not observed on a deployment. `maxDuration = 60` is exported from `app/layout.tsx` because `page.tsx` is a client component; Next documents segment config on a layout as applying to the Server Actions of its pages, but that an RPC call longer than 30 s completes on a Vercel preview, and the plan's duration cap, have not been tested. | `server/rate-limit.ts`, `server/transmission.ts`, `app/layout.tsx` | `d9w` |
| **Untested: pinned HTTPS connections.** Connecting to a validated IP while keeping SNI and certificate checks on the hostname follows the documented `https.request` behaviour but has no test against a real TLS server. | `server/outbound.ts` | not tracked yet |
| **Residual SSRF surface.** The public deployment can still send JSON POST requests to public hosts on allowed ports. Rate limits bound the volume. Daemons reachable only through NAT64 or 6to4 addresses are refused. | ADR 0003 consequences | accepted |
| **Self-hosting over plain HTTP does not work in production.** The `__Host-` cookie requires `Secure`, so run behind a TLS reverse proxy. | `server/session-cookie.ts` | ADR 0002 open question |
| Test coverage of the guard, cookie, schemas, limiter and headers is partial. | `apps/web/src/lib/**` | `c07.3`, `c07.11`, `c07.12`, `c07.13`, `c07.14`, `c07.15` |

**Platform rate limiting (public deployment).** The in-process limiter is best effort. For a public Vercel deployment add a firewall rate-limit rule on server-action calls (they are `POST` requests carrying the `Next-Action` header), keyed by IP. It is **not active yet** (owner action, `c07.18`). It cannot be expressed in `vercel.json`; create it once per project with the Vercel CLI (or the same fields in Firewall > Add Rule in the dashboard), then publish the staged change:

```bash
vercel firewall rules add "Seedora server actions" \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --condition '{"type":"header","op":"ex","key":"next-action"}' \
  --action rate_limit --rate-limit-window 60 --rate-limit-requests 1200 \
  --rate-limit-keys ip --rate-limit-action deny --yes
```

1200 a minute per IP leaves room for three tabs polling every second plus interactions (the in-process per-client limit is 900 a minute). Rate limiting availability depends on the Vercel plan; confirm it in the dashboard first. If it is unavailable and abuse shows up, the fallback is Upstash through the Marketplace (ADR 0004). Self-hosters put the equivalent rule in their reverse proxy.

**SSRF host policy.** A hosted proxy to a user-supplied host is SSRF by nature, so the server denies by default and self-hosters opt in. Self-hosters who run the web app on the same LAN as their daemon set `SEEDORA_ALLOW_PRIVATE_HOSTS=true`, and should add `SEEDORA_ALLOWED_HOSTS` (see [setup.md](setup.md#environment-variables)). A public deployment must leave the opt-in unset. Cloud metadata addresses stay denied even with the opt-in.

### Electron app

The window, IPC, file-path, origin, credential and launch hardening is implemented (see "What is in place"). What remains:

| Gap | Where | Tracked in |
|---|---|---|
| **Cleartext fallback where no secret store exists.** When `safeStorage` is unavailable (for example Linux without a keyring), passwords are kept in cleartext in the `0600` `config.json` and the UI warns. Nothing better is possible without an OS store. | `src/main/store/config-store.ts` | accepted |
| **Packaged-build verification is macOS only.** The `app://` behaviour (blocked `file://`, traversal, unapproved reads) was verified on one packaged build (macOS); Windows and Linux are not verified, and neither is the launch-target handling (magnet and `.torrent` association, the Windows UNC refusal) on any packaged build. | `src/main/security/app-protocol.ts`, `src/main/launch/` | `2df`, `23u.12` (still open in beads) |
| **Storage origin changed from `file://` to `app://seedora`.** Renderer-only `localStorage` written by an earlier build is not visible to the new origin and resets once on upgrade. Servers and preferences live in `config.json` and are not affected. | `src/renderer/` | accepted, see ADR 0006 |
| `style-src` still allows `'unsafe-inline'`; whether it can be dropped has not been evaluated. | `src/main/security/csp.ts` | not tracked yet |
| **Electron advisories that need a 41 or 42 major.** See [dependency-audit.md](dependency-audit.md). | `package.json` | `9xk`, `mi9.18` |

### Repository

- A localhost development TLS key pair is tracked under `apps/web/certificates/`. It protects nothing but local dev; it is untracked and ignored (`.gitignore`); it remains in the public git history.

## Rules for new code

1. The renderer and the browser are untrusted. Validate every IPC argument and every server-action argument at runtime.
2. A server action is a public HTTP endpoint. Never assume it is called by our UI or with our cookie.
3. Never read a file path, open a URL or contact a host that came from the renderer or the browser without checking it against what the user explicitly chose.
4. Credentials never go into logs, error messages, exports by default, or anything unencrypted on disk or in a cookie.
5. Daemon-supplied strings are rendered as text only.
