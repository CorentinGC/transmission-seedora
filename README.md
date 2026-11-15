# Seedora

[![Licence: MIT](https://img.shields.io/github/license/CorentinGC/transmission-seedora)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/CorentinGC/transmission-seedora)](https://github.com/CorentinGC/transmission-seedora/releases)

A cross-platform application to remotely manage a [Transmission](https://transmissionbt.com/) 4+ BitTorrent daemon. One shared React UI ships as a **desktop app** (macOS, Windows, Linux, built with Electron) and as a **web app** (Next.js, installable as a PWA), hosted at [seedora.app](https://www.seedora.app/).

## Why this project?

The existing [Transmission Remote GUI](https://github.com/transmission-remote-gui/transgui) (transgui), built with Lazarus/Free Pascal, suffers from frequent crashes and has not been actively maintained for years. Rather than patching an aging codebase, **Seedora** was rebuilt from scratch using a modern web-based stack while drawing heavy inspiration from transgui's feature set and UX.

This project was entirely **vibe-coded** — designed and implemented with the assistance of AI — taking transgui as the reference for features and user experience, but with a completely new codebase built on Electron, React, and TypeScript.

## Try it online

Use Seedora directly in your browser, no installation required: **[seedora.app](https://www.seedora.app/)**. The web server relays your requests to the daemon, so the daemon must be reachable from that server. Read [Known gaps and security](#known-gaps-and-security) first.

## Features

- **Multi-server management** — connect to multiple Transmission daemons and switch between them
- **Torrent operations** — add (URL/magnet/file), remove, move, rename, start, stop, verify, reannounce
- **Rich torrent details** — general info, file tree, peers (with GeoIP), trackers, per-torrent options
- **Daemon settings** — speed limits, network, download paths, queue management
- **Filter sidebar** — filter by status, tracker, or download directory
- **Keyboard shortcuts and context menu**
- **System tray and notifications** (desktop app)
- **Watch folder** — automatically add torrents from a monitored directory (desktop app)
- **Proxy support** — HTTP and SOCKS5 proxy for RPC connections (desktop app)
- **Dark mode** — system-aware dark/light theme
- **23 languages** — ar, cs, da, de, el, en, es, fi, fr, hu, it, ja, ko, nb, nl, pl, pt, ro, ru, sv, tr, uk, zh. Some translations are incomplete, see [docs/i18n.md](docs/i18n.md).

## Install the desktop app

Download an installer from [GitHub Releases](https://github.com/CorentinGC/transmission-seedora/releases): DMG or ZIP (macOS), Squirrel installer (Windows), deb or rpm (Linux).

Builds are **unsigned and not notarized**, and there is **no auto-update**: download new versions manually.

- **macOS, "App is damaged"**: Gatekeeper blocks unsigned apps. Run `xattr -cr /Applications/Seedora.app` (adjust the path to where you put the app), then open it.
- **Windows, SmartScreen "Unknown publisher"**: click "More info", then "Run anyway".
- **Linux**: `sudo dpkg -i seedora_*.deb` (Debian/Ubuntu) or `sudo rpm -i seedora-*.rpm` (Fedora/RHEL).

## Run from source

Prerequisites: [Node.js](https://nodejs.org/) 20 or later (`.nvmrc` pins the version used in CI), npm 10 or later, and a Transmission daemon with RPC enabled.

```bash
git clone https://github.com/CorentinGC/transmission-seedora.git
cd transmission-seedora
npm ci
```

Desktop app (Electron):

```bash
npm start              # development mode
npm run start:debug    # same, with remote debugging on port 9222
```

Web app (Next.js, http://localhost:3000):

```bash
npm run dev:web        # development server
npm run dev:web:https  # with HTTPS, needed to test the PWA and notifications
npm run build:web      # production build
npm run start:web      # serve the production build
```

Package the desktop app (unsigned, output in `out/`):

```bash
npm run package        # unpacked app
npm run make           # installers for the current platform
```

More detail: [docs/setup.md](docs/setup.md).

## Deploying the web app

The web app is a standard Next.js app (`apps/web`). Build it with `npm run build:web` and serve it with `npm run start:web`, or deploy it to a Next.js host. It needs a Node.js runtime because RPC calls go through server actions. This repository has no deployment workflow and no container image; the release workflow builds only the desktop installers ([docs/release.md](docs/release.md)).

Set `COOKIE_SECRET` in any deployment (see [docs/setup.md](docs/setup.md#environment-variables)). Do not expose a deployment publicly before reading the known gaps below.

## Project structure

npm workspaces monorepo. The Electron app is the root package.

| Path | What |
|------|------|
| `src/main/` | Electron main process: IPC handlers, Transmission RPC client, config store, menu, tray, watch folder |
| `src/preload/` | `contextBridge` exposing `window.api` |
| `src/renderer/` | thin Electron shell around the shared UI |
| `src/shared/` | IPC channel names and types shared by main and preload |
| `packages/shared/` | `@seedora/shared`: the whole UI (components, stores, hooks, locales, theme) |
| `apps/web/` | `@seedora/web`: Next.js app and server actions |
| `docs/` | architecture, setup, conventions, security, i18n, release, decisions |

The UI reaches the platform only through a `PlatformApi` abstraction. See [docs/architecture.md](docs/architecture.md).

## Tech stack

Electron 40 and Electron Forge with Vite 6; Next.js 16 (App Router); TypeScript 5.7; React 19; Tailwind CSS v4; TanStack Table and react-virtual; Zustand; i18next; lucide-react; chokidar; geoip-lite.

## Known gaps and security

Seedora has known security gaps that are confirmed and scheduled for fixing, including in the hosted web app (server-side request handling, how the active server's credentials are stored in a cookie, missing security headers) and in the desktop app (renderer hardening, input validation in IPC handlers, plaintext credentials on disk). The full list is in [docs/security.md](docs/security.md). Until they are fixed, use the web app only with a daemon and credentials you can afford to expose, and prefer the desktop app.

Other gaps: desktop builds are unsigned, there is no auto-update, and the automated test suite and CI on pull requests are not in place yet. Progress is tracked in the beads backlog (`.beads/issues.jsonl`).

To report a vulnerability, follow [SECURITY.md](SECURITY.md). Do not open a public issue.

## Contributing

Contributions are welcome: bug reports, fixes, features and translations. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Documentation index: [llms.txt](llms.txt).

## Licence

[MIT](LICENSE)

## Acknowledgments

- [Transmission Remote GUI (transgui)](https://github.com/transmission-remote-gui/transgui) — the original project that inspired this rewrite
- [Transmission](https://transmissionbt.com/) — the BitTorrent client this app controls

## Credits

Created by [@CorentinGC](https://github.com/CorentinGC) — [Eden Solutions](https://eden-solutions.pro)
