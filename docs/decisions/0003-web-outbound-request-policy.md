# 0003 — Web outbound request policy (SSRF guard)

- **Status:** Accepted (2026-11-15, recommendation adopted by the maintainer's delegation)
- **Date:** 2026-11-15
- **Issues:** seedora-transmission-c07.2 (guard), c07.3 (tests)

## Context

The web app's server is a proxy: `rpcRequest` and `testServerConnection` make the Next.js server POST to a host, port and path chosen by the caller. Anyone can call a server action with any arguments, and anyone can obtain a valid session cookie for any target (ADR 0002). Without a policy, the public deployment can be used to reach the hosting provider's internal network, cloud metadata endpoints and loopback services, and to scan ports.

A hosted proxy to a user-supplied host is SSRF by nature, so the fix is a policy: deny by default, with an opt-in for self-hosters (recorded in `MEMORY.md` and `docs/security.md`, 2026-11-15).

Facts checked:

- `undici` is not installed, and Next's global `fetch` cannot be pinned to an IP without it. Node's `http.request` / `https.request` accept a custom `lookup` function. Tested on Node 24: `lookup` is called with `{ all: true }` (Happy Eyeballs, the default since Node 20) and must then return an array of `{ address, family }`. TLS SNI and certificate verification keep the original hostname. **`lookup` is not called when `host` is an IP literal**, so literals need a separate check.
- `dns.lookup` (getaddrinfo) normalises numeric forms: `2130706433` and `0x7f.1` resolve to `127.0.0.1`. Classifying the *resolved* addresses therefore covers those encodings.
- `net.BlockList` checks subnets for both families, and on Node 24 it matches IPv4-mapped IPv6 (`::ffff:7f00:1`) against IPv4 rules. It does **not** match NAT64 (`64:ff9b::7f00:1`) or IPv4-compatible (`::127.0.0.1`) forms. The engine floor is Node 20.

## Decision

All outbound requests made on behalf of a caller go through one module, `apps/web/src/lib/server/outbound.ts`, which exposes a single `postJson(target, body, options)`. No other server code may call `fetch`, `http.request` or `https.request` with a caller-influenced destination.

### 1. Resolve once, validate all, connect to what was validated

1. If `host` is an IP literal (`net.isIP`), it is the only candidate address. Brackets are stripped from IPv6 literals.
2. Otherwise resolve it with `dns.promises.lookup(host, { all: true, verbatim: true })`, inside the request deadline.
3. Classify **every** resolved address. If **any** is denied, refuse the request (`HOST_NOT_ALLOWED`). Picking the "good" address would let an attacker mix records.
4. Issue the request with `http.request` / `https.request` using `host: <original hostname>` and a `lookup` that returns **the validated addresses only**, without a second DNS query and in both the `all: true` and single-address shapes. The socket connects to a validated IP, while `Host` and TLS SNI and certificate checks use the hostname. This removes the DNS-rebinding window.
5. The resolver is injectable (a parameter with the real `dns` as default), so tests need no network.

### 2. Address classification

Classification normalises first: an IPv4-mapped (`::ffff:a.b.c.d`) address is checked as its embedded IPv4 address by our own code, not left to `BlockList` behaviour that may differ between Node versions.

**Always denied, opt-in or not:**

| Range | Why |
|---|---|
| `0.0.0.0/8`, `::/128` | Unspecified; `0.0.0.0` reaches loopback on Linux |
| `169.254.169.254/32`, `169.254.170.2/32`, `169.254.170.23/32`, `fd00:ec2::254/128`, `fd00:ec2::23/128`, `fd20:ce::254/128`, `100.100.100.200/32`, `192.0.0.192/32`, `168.63.129.16/32` | Cloud metadata and platform endpoints (AWS/GCP/Azure, AWS ECS task metadata and EKS pod identity, AWS and GCP IPv6, Alibaba, Oracle, Azure WireServer) — see "Open question" |
| `224.0.0.0/4`, `ff00::/8` | Multicast |
| `240.0.0.0/4`, `255.255.255.255/32` | Reserved, broadcast |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32` | Documentation |
| `198.18.0.0/15` | Benchmarking |
| `192.0.0.0/24`, `192.88.99.0/24` | IETF protocol assignments, 6to4 relay anycast |
| `::/96` (IPv4-compatible), `64:ff9b::/96`, `64:ff9b:1::/48` (NAT64), `2002::/16` (6to4), `2001::/32` (Teredo), `100::/64` (discard), `2001:10::/28`, `2001:20::/28` (ORCHID) | Transition and embedding prefixes that can carry a private IPv4 address past the check |
| `fec0::/10` | Deprecated site-local |
| IPv6 outside `2000::/3`, other than the private ranges listed below | Only global unicast is routable on the public internet |

**Denied by default, allowed with `SEEDORA_ALLOW_PRIVATE_HOSTS=true`:**

| Range | What |
|---|---|
| `127.0.0.0/8`, `::1/128` | Loopback |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | RFC 1918 |
| `100.64.0.0/10` (except the Alibaba metadata address) | CGNAT (Tailscale and similar overlays live here) |
| `169.254.0.0/16` (except the metadata addresses above), `fe80::/10` | Link-local |
| `fc00::/7` (except the metadata addresses above) | IPv6 ULA |

The variable is read only through `env.ts`, and only the exact string `true` enables it. A public deployment must leave it unset. When it is set, the server logs one startup warning (without addresses).

### 3. Port policy

`port` is an integer from 1 to 65535 and must not be on the **WHATWG Fetch "bad ports" list** (the list browsers refuse: 1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665–6669, 6679, 6697, 10080). This blocks cross-protocol attacks on SMTP, IRC, SSH and similar services. Transmission's default 9091 and the common 80/443/8080 remain allowed. The list is a constant in the guard module, copied from the current spec (https://fetch.spec.whatwg.org/#port-blocking) at implementation time with a link to it. The copy above is indicative, and the spec's version wins. Port 0 is rejected by the range check.

### 4. Request behaviour

- Method `POST` only. Headers are built by the server: `Content-Type: application/json`, optional `Authorization` and `X-Transmission-Session-Id`. No caller-supplied header names.
- **Redirects are not followed.** Node's `http` never follows them; any 3xx is a failure (`UNEXPECTED_REDIRECT`). Transmission does not redirect its RPC endpoint.
- One `AbortSignal.timeout` deadline covers DNS, connect, the 409 session-id retry and the body read (values in ADR 0004).
- The response body is read up to a cap of **8 MiB** per request, then aborted (`RESPONSE_TOO_LARGE`). It is parsed as JSON in a `try`. Parsing multiplies the heap cost about twelve-fold, so the cap alone is not a memory bound; three more bounds apply (`outbound-limits.ts`, all in memory and per process):
  - a **global budget of 32 MiB** of buffered response bytes across in-flight calls; a chunk that does not fit aborts that call with `RATE_LIMITED`;
  - at most **8 concurrent calls per destination** (key: the sorted validated addresses plus the port, so alias host names share one cap), else `RATE_LIMITED`;
  - at most **3 concurrent `getaddrinfo` lookups**, 64 waiting. `getaddrinfo` runs on libuv's 4-thread pool and cannot be cancelled: an aborted lookup keeps its slot until it really returns, while the waiting call gets `TIMEOUT` at the deadline. c-ares (`dns.Resolver`, cancellable) was rejected because it ignores `/etc/hosts`, which self-hosters on a LAN rely on.
- Requests use `agent: false`, which ignores `HTTP_PROXY` / `NODE_USE_ENV_PROXY`: a proxy configured by the host environment can neither be bypassed by nor intercept the pinned connection (regression test in `outbound.test.ts`).
- The addresses that passed validation are available to callers through the optional `onResolved` option, called before any connection (used for per-destination rate limiting).
- TLS certificates are verified. There is no `rejectUnauthorized: false`, now or as an option.
- Errors become fixed codes (ADR 0004). Raw `err.message`, resolved addresses and the daemon's `statusText` never reach the caller or the logs.

## Open question

The acceptance criterion of c07.2 says `169.254.169.254` is "allowed with the opt-out". This ADR keeps metadata addresses denied **even with the opt-in**.

**Recommendation:** keep them always denied and amend c07.2. A self-hoster's daemon is never on a metadata address, while a self-hoster's web app running in a cloud VM with the opt-in set would otherwise expose that VM's credentials.

## Alternatives considered

- **`undici` `Agent` with `connect.lookup` + `fetch`**: equivalent pinning, but it adds a dependency that duplicates Node's bundled copy. `node:http(s)` does the job with no new dependency.
- **`request-filtering-agent`, `ssrf-req-filter` and similar packages**: small, but they are third-party code on the most security-sensitive path, with their own range lists and update cadence. Our list is about 40 lines and tested.
- **`ipaddr.js` for classification**: robust parsing, but `net.BlockList` plus explicit normalisation of the mapped form covers resolved (canonical) addresses with no dependency.
- **Validate the hostname, then let `fetch` resolve again**: vulnerable to DNS rebinding between check and connect.
- **Host allowlist configured by the operator**: right for a single-tenant install, wrong for the public seedora.app, where every user brings their own daemon. It can be added later on top of this policy.
- **Allow any port**: enables cross-protocol abuse of public mail and IRC servers from our IPs.

## Consequences

- The public deployment cannot reach loopback, private, link-local or metadata addresses, whatever the cookie or the DNS answers.
- Self-hosters whose daemon is on their LAN must set `SEEDORA_ALLOW_PRIVATE_HOSTS=true`. The UI shows a clear "host not allowed" error, which `docs/setup.md` must explain.
- Daemons reachable only over IPv6 NAT64 or 6to4 are refused. This is accepted as rare.
- Residual risk: the public deployment can still POST JSON to public hosts on allowed ports. Rate limiting (ADR 0004) bounds the volume.
- Range lists need occasional review (IANA special-purpose registries). The guard's test table is the reference.
