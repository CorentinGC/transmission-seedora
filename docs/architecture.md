# Architecture

Seedora is a remote GUI for the Transmission BitTorrent daemon. One React UI ships in two shells: an Electron desktop app and a Next.js web app (PWA). Both talk to the daemon through its RPC endpoint; neither talks to it from the browser context directly.

## Monorepo layout

npm workspaces (`packages/*`, `apps/*`). The Electron app is the **root package**, not a workspace.

| Path | Package | Role |
|---|---|---|
| `src/main/` | `seedora` (root) | Electron main process: window, native menu, tray, watch folder, config store, RPC client, IPC handlers |
| `src/preload/preload.ts` | root | `contextBridge` bridge exposing `window.api` (typed in `src/preload/api.d.ts`) |
| `src/renderer/` | root | Thin Electron shell: `main.tsx`, `App.tsx`, `electron-api.ts`, `hooks/` |
| `src/shared/` | root | Code shared by main and preload: `ipc-channels.ts`, `types.ts`, `key-utils.ts` |
| `packages/shared/src/` | `@seedora/shared` | The whole UI, used by both apps |
| `apps/web/` | `@seedora/web` | Next.js 16 App Router shell + server actions |
| `resources/` | — | App icons and logo sources |
| `scripts/generate-icons.mjs` | — | Icon generation (`npm run generate:icons`) |

### `packages/shared/src/`

| Dir | Content |
|---|---|
| `components/ui/` | Primitives: `Button`, `Input`, `Select`, `Checkbox`, `Dialog`, `Tabs`, `Field`, `SectionHeading`, `LabelValueRow`, `ContextMenuItem` |
| `components/layout/` | `AppShell`, `Toolbar`, `StatusBar`, `DiskSpaceDialog`, `SessionStatsDialog`, `SpeedLimitPopover` |
| `components/filter/` | `FilterSidebar` |
| `components/torrent/` | `TorrentTable`, `TorrentColumns`, context menus, add / remove / rename / set-location dialogs |
| `components/details/` | `DetailsPanel` and its tabs (General, Files, Peers, Trackers, Options) |
| `components/server/` | `ServerSwitcher`, `ServerFormDialog` |
| `components/settings/` | `SettingsDialog` (daemon settings tabs), `AppPrefsDialog` (app preferences) |
| `stores/` | Zustand stores (see below) |
| `hooks/` | `usePolling`, `useTorrents`, `useSessionStats`, `useKeyboardShortcuts`, `useMenuEvents` |
| `lib/` | `format`, `torrent-parser` (bencode), `path-mapping`, `i18n`, `i18n-utils`, `constants`, `utils` |
| `platform/` | `PlatformApi` abstraction (see below) |
| `types/` | `torrent`, `session`, `server` types |
| `locales/` | 23 translation files — see [i18n.md](i18n.md) |
| `globals.css` | Theme tokens (light / dark) |

`packages/shared/package.json` declares `main`/`types` as `src/index.ts`, which does not exist. The package is consumed through the `@shared/*` path alias only, never by package name.

## Entry points

| App | Chain |
|---|---|
| Electron main | `src/main/index.ts` |
| Electron preload | `src/preload/preload.ts` |
| Electron renderer | `index.html` → `src/renderer/main.tsx` → `App` → `AppShell` |
| Web | `apps/web/src/app/layout.tsx` → `page.tsx` (`dynamic(..., { ssr: false })`) → `lib/SeedoraApp.tsx` → `WebApp` → `AppShell` |

The web app is a client-only SPA: one route (`/`), no `app/api`, no middleware. The server side exists only for the server actions.

## PlatformApi

`packages/shared/src/platform/api-types.ts` defines `PlatformApi`: server management, Transmission RPC calls, config export/import, preferences, plus optional Electron-only methods (`readFileBase64`, `dialog*`, `trayUpdate`, `notificationShow`, `watcherRestart`, `geoipLookup`, `onMenuEvent`). Shared code must check optional methods before calling them.

Two access paths to the same instance, both initialised at startup by each shell:

- `api-store.ts` — module-level singleton (`initPlatformApi` / `getPlatformApi`), used by the stores.
- `api-context.tsx` — React context (`ApiProvider`), used by components.

| Implementation | File | Storage | RPC transport |
|---|---|---|---|
| Electron | `src/renderer/electron-api.ts` | `config.json` in Electron `userData` (`src/main/store/config-store.ts`) | IPC to main |
| Web | `apps/web/src/lib/web-api.ts` | `localStorage` (`apps/web/src/lib/web-storage.ts`) + active-server cookie | Server actions |

Every method returns `IpcResponse` (`{ success, data?, error? }`) — failures are returned, not thrown.

## RPC data flow

**Electron**

```
component / store
  → PlatformApi (electron-api.ts)
  → window.api (preload.ts, contextBridge)
  → ipcRenderer.invoke(IPC.RPC_*)
  → ipcMain.handle (src/main/ipc/rpc-handlers.ts)
  → connectionManager.getActiveClient() (src/main/rpc/connection-manager.ts)
  → TransmissionRpcClient.request (src/main/rpc/client.ts)
  → Transmission daemon
```

The main-process client owns the `X-Transmission-Session-Id` handshake (409 → retry once), Basic auth, and optional HTTP / SOCKS5 proxy agents.

**Web**

```
component / store
  → PlatformApi (web-api.ts)
  → server action rpcRequest (apps/web/src/lib/server-actions/rpc.ts)
  → reads the active server from the cookie (server-actions/session.ts)
  → fetch → Transmission daemon
```

The Next.js server is the proxy: the daemon must be reachable **from the server**, not from the user's browser. Session IDs are cached in a module-level `Map` per server instance. Proxy settings are not supported on web.

## State

Zustand stores in `packages/shared/src/stores/`:

| Store | Hook | Holds |
|---|---|---|
| `server-store.ts` | `useServerStore` | Server list, active server, connection status and error |
| `torrent-store.ts` | `useTorrentStore` | Torrent map, selection, sorting, filters (search, status, label, tracker, folder), torrent actions |
| `session-store.ts` | `useSessionStore` | Daemon session settings, stats, free / total disk space |
| `ui-store.ts` | `useUiStore` | Panel visibility and sizes, table column layout, app preferences (theme, polling interval, …) |

Polling is driven by `usePolling` / `useTorrents` / `useSessionStats`.

## Electron-only features

Native menu (`src/main/menu.ts`, sends `menu:*` events to the renderer), tray (`tray.ts`), watch folder (`watcher.ts`, chokidar), GeoIP lookup (`ipc/handlers.ts`, `geoip-lite`), desktop notifications (`index.ts`).

## `@shared` alias — to be unified, see backlog

`@shared` does not resolve to the same directory everywhere:

| Build | Config | `@shared` → |
|---|---|---|
| Main | `vite.main.config.ts` | `src/shared` |
| Preload | `vite.preload.config.ts` | `src/shared` |
| Renderer | `vite.renderer.config.ts` | `packages/shared/src` |
| Web | `apps/web/tsconfig.json` | `../../packages/shared/src` |
| Type-check | root `tsconfig.json` | both, `packages/shared/src` first |

Consequences today: `types.ts` and `key-utils.ts` exist in both `src/shared/` and `packages/shared/src/` and must be kept identical by hand; `ipc-channels.ts` exists only in `src/shared/`. Until this is unified, a change to shared types has to be applied in both places.

## Build outputs

| Command | Output |
|---|---|
| `npm start` | Vite dev server for the renderer + main/preload bundles in `.vite/build/` |
| `npm run package` / `make` | `out/` (packaged app, installers in `out/make/`) |
| `npm run build:web` | `apps/web/.next/`, generated service worker in `apps/web/public/` |

`geoip-lite` is not bundled: it is `external` in `vite.main.config.ts`, copied into the package by `copyExternalModules` in `forge.config.ts`, and unpacked from the asar.
