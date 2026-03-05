# Seedora

A modern, cross-platform desktop application to remotely manage a [Transmission](https://transmissionbt.com/) 4+ BitTorrent daemon.

## Why this project?

The existing [Transmission Remote GUI](https://github.com/transmission-remote-gui/transgui) (transgui), built with Lazarus/Free Pascal, suffers from frequent crashes and has not been actively maintained for years. Rather than patching an aging codebase, **Seedora** was rebuilt from scratch using a modern web-based stack while drawing heavy inspiration from transgui's feature set and UX.

This project was entirely **vibe-coded** — designed and implemented with the assistance of AI — taking transgui as the reference for features and user experience, but with a completely new codebase built on Electron, React, and TypeScript.

## Features

- **Multi-server management** — connect to multiple Transmission daemons and switch between them
- **Torrent operations** — add (URL/magnet/file), remove, move, rename, start, stop, verify, reannounce
- **Rich torrent details** — general info, file tree, peers (with GeoIP), trackers, per-torrent options
- **Daemon settings** — speed limits, network, download paths, queue management
- **Filter sidebar** — filter by status, tracker, or download directory
- **Keyboard shortcuts & context menu** — efficient workflow for power users
- **System tray & notifications** — minimize to tray, torrent completion alerts
- **Watch folder** — automatically add torrents from a monitored directory
- **Proxy support** — HTTP and SOCKS5 proxy for RPC connections
- **Dark mode** — system-aware dark/light theme
- **i18n** — 23 languages supported
- **Cross-platform** — macOS (DMG/ZIP), Windows (Squirrel installer), Linux (deb/rpm)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Electron](https://www.electronjs.org/) 40 + [Electron Forge](https://www.electronforge.io/) |
| Build tool | [Vite](https://vite.dev/) 6 |
| Language | [TypeScript](https://www.typescriptlang.org/) 5.7 |
| UI framework | [React](https://react.dev/) 19 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 + shadcn-style CSS variables |
| Data table | [TanStack Table](https://tanstack.com/table) v8 + [@tanstack/react-virtual](https://tanstack.com/virtual) |
| State management | [Zustand](https://zustand.docs.pmnd.rs/) |
| Internationalization | [i18next](https://www.i18next.com/) + react-i18next |
| Icons | [Lucide React](https://lucide.dev/) |
| File watching | [chokidar](https://github.com/paulmillr/chokidar) |
| GeoIP | [geoip-lite](https://github.com/bluesmoon/node-geoip) |

## Project Structure

```
src/
├── main/               # Electron main process
│   ├── index.ts         # App entry point, window creation
│   ├── menu.ts          # Native application menu
│   ├── tray.ts          # System tray integration
│   ├── watcher.ts       # Watch folder (chokidar)
│   ├── ipc/             # IPC handlers (main ↔ renderer)
│   ├── rpc/             # Transmission RPC client (HTTP, CSRF, proxy)
│   └── store/           # electron-store config persistence
├── preload/
│   └── preload.ts       # Typed contextBridge API (window.api)
├── renderer/            # React application
│   ├── components/
│   │   ├── details/     # Torrent detail tabs (General, Files, Peers, Trackers, Options)
│   │   ├── filter/      # Filter sidebar (status, tracker, directory)
│   │   ├── layout/      # AppShell, Toolbar, StatusBar
│   │   ├── server/      # Server switcher & connection dialog
│   │   ├── settings/    # Daemon settings dialog (Speed, Network, Download, Queue)
│   │   ├── torrent/     # Torrent table, dialogs (Add, Remove, Move, Rename), context menu
│   │   └── ui/          # Shared UI primitives (Button, Dialog, Input, etc.)
│   ├── stores/          # Zustand stores (server, torrent, session, ui)
│   ├── lib/             # Utilities, i18n config
│   └── locales/         # Translation files (en.json, fr.json)
└── shared/              # Shared types & IPC channel constants
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- npm >= 10
- A running [Transmission](https://transmissionbt.com/) daemon with RPC enabled

### Installation

```bash
git clone https://github.com/CorentinGC/seedora.git
cd seedora
npm install
```

### Development

```bash
# Start the app in development mode
npm start

# Start with Chrome DevTools remote debugging (port 9222)
npm run start:debug
```

### Build & Package

```bash
# Package the app for your platform
npm run package

# Create distributable installers
npm run make
```

Supported targets:
- **macOS** — DMG, ZIP
- **Windows** — Squirrel installer
- **Linux** — deb, rpm

## Contributing

Contributions are welcome! Here are some areas where help is appreciated:

- **Translations** — add new languages in `src/renderer/locales/`
- **Bug reports & fixes** — open an issue or submit a PR
- **New features** — check the issues for ideas or propose your own
- **Testing** — the project currently has no automated tests

### Development Tips

- The app communicates with Transmission via its [RPC protocol](https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md) — the spec is the source of truth for all RPC types
- IPC channels between main and renderer are all defined in `src/shared/ipc-channels.ts`
- State is managed by 4 Zustand stores — keep logic in stores, components stay presentational
- Tailwind v4 is used with CSS variables for theming — see `src/renderer/index.css` for the color tokens
- ESM-only packages must use dynamic `import()` in the main process or be marked `external` in `vite.main.config.ts`

## License

[Non-Commercial Open Source License](LICENSE) — Free to use, modify, and distribute. Commercial use and resale are prohibited.

## Acknowledgments

- [Transmission Remote GUI (transgui)](https://github.com/transmission-remote-gui/transgui) — the original project that inspired this rewrite
- [Transmission](https://transmissionbt.com/) — the BitTorrent client this app controls

## Credits

Created by [@CorentinGC](https://github.com/CorentinGC) — [Eden Solutions](https://eden-solutions.pro)
