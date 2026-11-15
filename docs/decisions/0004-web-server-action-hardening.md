# 0004 — Web server actions: validation, RPC allowlist, timeouts, errors, rate limiting

- **Status:** Accepted (2026-11-15, recommendation adopted by the maintainer's delegation)
- **Date:** 2026-11-15
- **Issues:** seedora-transmission-c07.4 (validation, allowlist), c07.5 (timeout, rate limit), c07.6 (GeoIP cap)

## Context

Server actions are public HTTP endpoints. Today, in `apps/web/src/lib/server-actions/`:

- `rpcRequest(method, args)` forwards any method name and argument object.
- `testServerConnection(config)` and `setActiveServerCookie(config)` accept any object.
- `geoipLookup(ips)` accepts an unbounded array.
- `doFetch` has no timeout, and nothing limits call rates.
- Errors return `err.message` and `HTTP <status>: <statusText>`, which give a caller a network-probing oracle.
- The session-id `Map` is unbounded.
- The 409 handshake is duplicated between `rpcRequest` and `testServerConnection`.

Constraints:

- **Hosting is Vercel serverless** (user decision 2026-11-15); self-hosting with `next start` must keep working. There is no shared store today.
- `zod` is **not installed**. Adding it edits `apps/web/package.json` and the lockfile, which qa-engineer is changing under we5.1.
- The web app polls every 5 s by default (`web-storage.ts` defaults; the user can lower it to 1 s, the `AppPrefsDialog` minimum). Each tick makes about 4 RPC calls (`torrent-get`, plus `session-stats`, `session-get` and `free-space` from `useSessionStats`), plus one more when a details tab is open. That is about 60 calls/min per tab at the default and up to about 300/min at 1 s.
- `PeersTab` sends every peer IP of a torrent to `geoipLookup` in one call.
- The UI shows `IpcResponse.error` strings as they are. Translating them is outside this decision.

## Decision

### 1. Layout: actions are thin, logic lives in plain modules

`'use server'` files export **only** actions. Every action follows the same order: **client rate limit → validate → act → map errors**, where the per-destination rate limit runs inside the act step, once the addresses are resolved (`onResolved`, see section 6). The logic lives in non-action modules under `apps/web/src/lib/server/`:

| Module | Responsibility |
|---|---|
| `env.ts` | Lazy, validated reads of `COOKIE_SECRET`, `COOKIE_SECRET_PREVIOUS`, `SEEDORA_ALLOW_PRIVATE_HOSTS`, `SEEDORA_ALLOWED_HOSTS` (comma list of `host` or `host:port`, validated at boot, ADR 0003), `SEEDORA_TRUST_PROXY_HEADERS`; throws a plain `ConfigError`, which the actions map to `SERVER_MISCONFIGURED` |
| `session-cookie.ts` | Seal, unseal, set and clear (ADR 0002) |
| `schemas.ts` | zod schemas and the RPC method allowlist |
| `address-policy.ts` | IP classification and port policy (ADR 0003) |
| `outbound.ts` | `postJson`: pinned resolution, deadline, size cap, no redirects (ADR 0003) |
| `transmission.ts` | The Transmission call: Basic auth, 409 session-id handshake inside one deadline, bounded session-id cache, result mapping. Used by both `rpcRequest` and `testServerConnection` |
| `rate-limit.ts` | Token buckets and client-key derivation |
| `errors.ts` | Error codes and their fixed messages |

### 2. Validation with zod

Add `zod` (`^4`, current 4.6.x) to `apps/web` dependencies. It is the de-facto TypeScript runtime validator, has no dependencies and is platform-agnostic, so the Electron IPC validation in epic 23u can use the same library.

- **Server target** (`setActiveServerCookie`, `testServerConnection`, and the cookie after unsealing):
  - `host`: a hostname (LDH labels, at most 253 characters) or an IPv4/IPv6 literal. No scheme, userinfo, path, whitespace or `%` zone id.
  - `port`: an integer from 1 to 65535. The bad-port check is in the guard.
  - `path`: starts with `/`, at most 256 characters, characters `[A-Za-z0-9._~!$&'()*+,;=:@/-]`, no `..` segment, no `?` or `#`. The default is `/transmission/rpc`.
  - `useSSL`: a boolean.
  - `username` and `password`: optional strings of at most 256 characters each.
  - Unknown keys are **stripped**, so the client can keep sending a full `ServerConfig`.
- **RPC call** (`rpcRequest`): `method` must be in the allowlist. `args` must be absent or a plain object. It is normalised with a JSON round trip first (`undefined` values are dropped and `NaN` becomes `null`, exactly what the old proxy put on the wire), then checked as a JSON object (`z.record(z.string(), z.json())`) of at most 1 MiB serialised. Well-known keys get a shape; `filename` (a magnet link or URL) may be 64 KiB, other text keys 4 KiB. We do not model each Transmission argument: the daemon validates its own semantics, and the caller holds the daemon credentials. Our boundary protects **our server and third parties**, not the user's own daemon from the user.
- **GeoIP** (`geoipLookup`): an array of at most **512** strings, each a valid IP (`net.isIP`), deduplicated. Larger input is rejected (`INVALID_INPUT`). `web-api.ts` splits larger peer lists into chunks of 512 and merges the results, so large swarms keep working.
- Validation failures return `INVALID_INPUT` before any DNS lookup or socket.
- The 1 MiB `args` cap matches Next's default server-action body limit (1 MB, not re-checked for 16.1.6). A `torrent-add` with a large base64 `.torrent` already fails today at that limit. Raising both together is a separate decision.

### 3. RPC method allowlist

The methods `web-api.ts` actually uses, and no others:

`torrent-get`, `torrent-set`, `torrent-add`, `torrent-remove`, `torrent-start`, `torrent-start-now`, `torrent-stop`, `torrent-verify`, `torrent-reannounce`, `torrent-set-location`, `torrent-rename-path`, `queue-move-top`, `queue-move-up`, `queue-move-down`, `queue-move-bottom`, `session-get`, `session-set`, `session-stats`, `session-close`, `free-space`, `port-test`, `blocklist-update`, `group-get`, `group-set`.

A new `PlatformApi` RPC method must be added here in the same change. `session-set` keeps exposing the `script-torrent-*` settings, as documented "by design" in `docs/security.md`.

### 4. Timeouts

One deadline per action call (an `AbortSignal.timeout`) covers DNS, connect, the 409 retry and the body read:

| Call | Deadline |
|---|---|
| `testServerConnection` | 8 s |
| `rpcRequest`: `blocklist-update`, `port-test`, `torrent-add` (the daemon may fetch a URL) | 30 s |
| `rpcRequest`: every other method | 15 s |

These are constants in `transmission.ts`, not caller-supplied. The function's maximum duration on the Vercel project was **not verified** while writing this ADR. c07.10 must confirm it is above 30 s, or set `maxDuration` for the route, before relying on the 30 s deadline.

### 5. Error codes

Actions return `{ success: false, error: <fixed message>, code: <code> }`. `IpcResponse` already allows extra fields at runtime, and `web-api.ts` reads `code`. No change to the shared type is needed for this epic.

The codes are `INVALID_INPUT`, `NO_SESSION`, `RATE_LIMITED`, `HOST_NOT_ALLOWED`, `DNS_FAILED`, `CONNECTION_FAILED`, `TIMEOUT`, `TLS_FAILED`, `UNEXPECTED_REDIRECT`, `RESPONSE_TOO_LARGE`, `AUTH_FAILED` (401), `HTTP_ERROR` (any other non-2xx, without the status text), `SESSION_ID_REJECTED`, `RPC_ERROR` (the daemon's `result` string is passed through: it is daemon data the user is entitled to see), `SERVER_MISCONFIGURED` (missing secret), `SESSION_UNAVAILABLE` (client side only: a re-seal succeeded but the cookie still did not come back, for example because cookies are blocked; the client stops re-sealing for 30 s).

Nothing derived from `err.message`, resolved addresses or credentials is returned or logged. An unexpected error (configuration problem, unknown class) is logged once as its class name and the returned code, nothing else (`logActionFailure` in `action-error.ts`); expected failures (`OutboundError`, a session too large for a cookie, which `session-cookie.ts` throws as a typed `SessionTooLargeError`) are not logged. Every action maps errors through `failureFromError`.

### 6. Rate limiting

**What is realistic without a shared store.** On Vercel, function instances are created and recycled at will, and concurrent requests may be spread across instances. An in-memory limiter is therefore **per instance and best effort**. It stops a single client hammering a warm instance and bounds amplification per instance, but a distributed or patient attacker gets through. It cannot be a guarantee, and this ADR does not claim it is one.

Decision, in two layers:

1. **In-process token buckets** (`rate-limit.ts`, no dependency), with a bounded LRU of at most 10 000 keys:

   | Bucket | Key | Sustained | Burst |
   |---|---|---|---|
   | `rpcRequest` | client | 900/min | 150 |
   | `rpcRequest` and `testServerConnection` | resolved destination address (IPv6 per /64, IPv4-mapped as IPv4) | 1800/min | 300 |
   | `testServerConnection` | client | 10/min | 5 |
   | `setActiveServerCookie` | client | 30/min | 10 |
   | `geoipLookup` | client | 60/min | 20 |

   **Destination key.** The destination bucket is keyed by each **resolved address**, not by the host name the caller typed (bead 9s8): wildcard DNS, a trailing dot or numeric spellings would otherwise each get a fresh 300-token burst. The limiter is the `onResolved` callback of `postJson` (`takeDestinationTokens` in `limits.ts`): it takes one token per address of the answer, in the same canonical form as client keys, and refuses the call when any address is empty, so listing a victim's address next to a fresh one gains nothing. `testServerConnection` draws on the same buckets. A call that never resolves (DNS failure) draws no destination token; the client limit and the lookup cap in ADR 0003 bound it.

   The `rpcRequest` client limit leaves room for three tabs at the 1 s minimum polling interval, so a legitimate user never sees a false `RATE_LIMITED`, which would break polling. Over the limit, an action returns `RATE_LIMITED` without any outbound request. The values are constants and can be tuned once real traffic is known.

   **Client key.** On Vercel (`VERCEL=1`), the client IP from the forwarding header Vercel sets. Which header Vercel guarantees to overwrite (`x-forwarded-for` or `x-vercel-forwarded-for`) must be confirmed against Vercel's docs in c07.5; it was not verified here. Elsewhere, the header is used only when `SEEDORA_TRUST_PROXY_HEADERS=true`, because without a proxy it is caller-controlled. Only the **last** entry of the header is read (the one our proxy appended), with any port stripped. It is canonicalised: IPv4-mapped IPv6 maps to the IPv4 key, other IPv6 addresses are keyed by their **/64**. When a proxy is trusted but the header is missing or unusable, the key is the shared key (a strict shared bucket, never "no limit"). When no proxy is trusted at all there is no reliable client identity, so the **per-client `rpcRequest` bucket is skipped** (it would put every user and tab in one bucket and break polling). The destination, `testServerConnection`, `setActiveServerCookie` and `geoipLookup` buckets still apply, with a shared key. A self-hosted instance is typically single-user.

2. **Platform rate limiting on the public deployment** — see "Open question". It is configuration, not code: a Vercel Firewall rule on `POST` requests that carry the `Next-Action` header, limited per IP.

## Open question

How should the public deployment be rate limited beyond the best-effort in-process limiter?

**Recommendation:** a Vercel Firewall rate-limit rule, set up in the dashboard by the user. It needs no code and no new service, and it applies before our function runs. Plan availability and limits must be confirmed in the Vercel dashboard or docs at the time; they were not verified while writing this ADR.

If abuse shows up and the plan does not offer firewall rate limiting, move to a shared store: Upstash Redis with `@upstash/ratelimit` through the Vercel Marketplace. That costs a dependency, a secret and an external service, so it should only be added on evidence.

## Alternatives considered

- **Hand-written validators instead of zod**: no dependency, but a dozen ad-hoc type guards across web and, soon, Electron IPC. zod gives one tested vocabulary and inferred types. The issue asked for it, and the dependency is small with no transitive packages.
- **A full per-method zod model of Transmission arguments**: a large surface to maintain against daemon versions, for no security gain at our boundary (see §2).
- **Upstash or Redis rate limiting now**: a real global limit, but it adds a dependency, a secret and a paid service before any observed abuse.
- **No in-process limiter, platform only**: self-hosters would have nothing, and the platform rule might not be available on the plan.
- **Keeping error passthrough for "better diagnostics"**: it gives an SSRF and port-scan oracle. The fixed codes keep enough detail for users: auth failed, host not allowed, timeout.

## Consequences

- An unknown method or a malformed config is rejected before any network activity.
- Every outbound call is bounded in time and size. A hung daemon cannot pin a function.
- Error messages get coarser. Translating the codes in the UI is separate work (i18n epic) and not required here.
- `zod` becomes a dependency of `apps/web`. Its installation is sequenced after we5.1 to avoid lockfile conflicts.
- Limits are per instance on Vercel until a platform or shared-store limit exists. `docs/security.md` must state this residual risk.
