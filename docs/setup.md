# Setup

## Prerequisites

- Node.js >= 22.12 (CI builds on Node 22), npm >= 10
- A Transmission daemon with RPC enabled, reachable from your machine

## Install

```bash
npm ci        # installs the root package and both workspaces
```

There is a single lockfile (`package-lock.json`) at the root. Use npm, not yarn or pnpm.

## Run the Electron app

```bash
npm start              # dev mode, renderer on http://localhost:5173/
npm run start:debug    # same, with --remote-debugging-port=9222
```

`start:debug` is the mode the `chrome-devtools` MCP server attaches to. The debugging port is a dev-only flag passed by the npm script; it is not present in packaged builds.

## Run the web app

```bash
npm run dev:web          # next dev --turbopack, http://localhost:3000
npm run dev:web:https    # same with --experimental-https (needed to test PWA / notifications)
npm run build:web        # production build
npm run start:web        # serve the production build
```

The web server proxies RPC calls: the daemon must be reachable from the machine running Next.js, and a daemon on a private address needs `SEEDORA_ALLOW_PRIVATE_HOSTS` (see [Environment variables](#environment-variables)).

## Build and package (Electron)

```bash
npm run package    # unpacked app in out/
npm run make       # installers in out/make/ (DMG + ZIP on macOS, Squirrel on Windows, deb + rpm on Linux)
```

Builds are unsigned. See [release.md](release.md).

## Other scripts

| Script | Purpose |
|---|---|
| `npm run lint` | ESLint over `.ts` / `.tsx` |
| `npm run generate:icons` | Regenerate app icons from the source PNG (`scripts/generate-icons.mjs`) |

Run `npm run` for the current full list. `npm run typecheck`, `npm test` (Vitest) and `npm run i18n:check` also exist.

## Environment variables

Web app only, read lazily by `apps/web/src/lib/server/env.ts` (decisions: [ADR 0002](decisions/0002-web-session-cookie.md), [0003](decisions/0003-web-outbound-request-policy.md), [0004](decisions/0004-web-server-action-hardening.md)). There is no `.env.example` file; set them in the host's environment.

| Variable | Required | Purpose |
|---|---|---|
| `COOKIE_SECRET` | production | Secret that seals the session cookie. At least 32 characters, for example `openssl rand -base64 32`. In production a missing or short value stops the server at startup (`instrumentation.ts`). In development an unset value gives a random per-process secret, so sessions do not survive a restart. A set but short value is always an error. |
| `COOKIE_SECRET_PREVIOUS` | no | Secret being rotated out, accepted for reading only. To rotate: set it to the old value, set `COOKIE_SECRET` to a new one, deploy, and remove it after 4 hours (the cookie lifetime). |
| `SEEDORA_ALLOW_PRIVATE_HOSTS` | no | Only the exact value `true` enables it. Lets the server reach loopback, private, CGNAT and link-local addresses, which are denied by default. Needed when the daemon is on the same LAN as the web server. Leave unset on a public deployment. Cloud-metadata addresses stay denied. |
| `SEEDORA_ALLOWED_HOSTS` | no | Comma-separated `host` or `host:port` entries (IPv6 as `[addr]` or `[addr]:port`), for example `nas.lan:9091`. With `SEEDORA_ALLOW_PRIVATE_HOSTS=true`, private addresses are reachable only for the listed hosts. An entry without a port matches every port, so prefer `host:port`. Matched against the name the user typed, so list only names whose DNS you control. A malformed entry stops the server at startup; without the opt-in the list has no effect and a warning is logged. |
| `SEEDORA_TRUST_PROXY_HEADERS` | no | Only the exact value `true` enables it. The client IP for per-client rate limiting is then read from the last entry of `X-Forwarded-For`. Set it only behind a reverse proxy that overwrites that header; elsewhere the header is caller-controlled. On Vercel it is not needed. Without a trusted client identity there is no per-client limit. |
| `NODE_ENV` | no | Standard. In Electron, enables DevTools on window creation. In web dev it disables the service worker, drops the `Secure` flag and `__Host-` prefix of the cookie, and relaxes the CSP and HSTS. |

A host refused by the guard shows a "host not allowed" error in the UI. If your daemon is on a private address and you see it, set `SEEDORA_ALLOW_PRIVATE_HOSTS=true` on a self-hosted instance. The production session cookie is `Secure`, so a self-hosted production build must be served over HTTPS (for example behind a TLS reverse proxy); plain `http://` never receives the cookie.

No `.env` file is required for local development.

## MCP servers (`.mcp.json`)

| Server | Targets | How |
|---|---|---|
| `chrome-devtools` | **Electron app** | Attaches to `http://127.0.0.1:9222` — requires `npm run start:debug` to be running |
| `chrome-devtools-web` | **Web app** | Launches its own isolated Chrome (1440×900, accepts the self-signed dev certificate); navigate it to the `dev:web` URL |

Agents never start the Electron or web servers themselves: a human starts them, the agent attaches.
