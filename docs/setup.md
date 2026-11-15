# Setup

## Prerequisites

- Node.js >= 20 (CI builds on Node 20), npm >= 10
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

The web server proxies RPC calls: the daemon must be reachable from the machine running Next.js.

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

Run `npm run` for the current full list — check, test and i18n scripts are being added.

## Environment variables

| Variable | App | Purpose |
|---|---|---|
| `COOKIE_SECRET` | web | Declared in `apps/web/src/lib/server-actions/session.ts`. Currently has a hardcoded fallback and is not actually used to protect the cookie — see [security.md](security.md). Set it anyway in any deployment. |
| `NODE_ENV` | both | Standard. Enables DevTools on window creation in Electron; disables the service worker and the `secure` cookie flag in web dev. |

No `.env` file is required for local development.

## MCP servers (`.mcp.json`)

| Server | Targets | How |
|---|---|---|
| `chrome-devtools` | **Electron app** | Attaches to `http://127.0.0.1:9222` — requires `npm run start:debug` to be running |
| `chrome-devtools-web` | **Web app** | Launches its own isolated Chrome (1440×900, accepts the self-signed dev certificate); navigate it to the `dev:web` URL |

Agents never start the Electron or web servers themselves: a human starts them, the agent attaches.
