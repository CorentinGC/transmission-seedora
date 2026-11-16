# Architecture

Seedora is a remote GUI for the Transmission BitTorrent daemon. One React UI ships in two shells: an Electron desktop app and a Next.js web app (installable via a static web manifest; there is no service worker). Both talk to the daemon through its RPC endpoint; neither talks to it from the browser context directly.

The web deployment also serves a static landing page: `apps/web/src/proxy.ts` routes by host (`seedora.app` landing, `app.seedora.app` app, `www` redirect); rules in `src/lib/site/hosts.ts`, copy in `src/lib/site/content.ts` ([ADR 0008](decisions/0008-landing-site-and-app-subdomain.md)).

## Monorepo layout

npm workspaces (`packages/*`, `apps/*`). The Electron app is the **root package**, not a workspace.

| Path | Package | Role |
|---|---|---|
| `src/main/` | `seedora` (root) | Electron main process: window, native menu, tray, watch folder, config store, RPC client, IPC handlers, `security/` (IPC guard, schemas, approved paths, window guards, CSP, `app://` scheme, script guard, server credentials), `launch/` (magnet and `.torrent` targets from the OS), `i18n/` (native menu, tray and dialog strings) |
| `src/preload/preload.ts` | root | `contextBridge` bridge exposing `window.api` (typed in `src/preload/api.d.ts`) |
| `src/renderer/` | root | Thin Electron shell: `main.tsx`, `App.tsx`, `electron-api.ts`, `hooks/` |
| `src/shared/` | root | Code shared by main and preload: `ipc-channels.ts` (alias `@ipc`) |
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
| Electron renderer | `index.html` → `src/renderer/main.tsx` → `App` → `AppShell`; packaged builds load it from `app://seedora/index.html`, development from the Vite dev server |
| Web | `apps/web/src/app/layout.tsx` → `page.tsx` (`dynamic(..., { ssr: false })`) → `lib/SeedoraApp.tsx` → `WebApp` → `AppShell` |

The web app is a client-only SPA: one route (`/`), no `app/api`, no middleware. The server side exists only for the server actions.

## PlatformApi

`packages/shared/src/platform/api-types.ts` defines `PlatformApi`: server management, Transmission RPC calls, config export/import, preferences, plus optional Electron-only methods (`readFileBase64`, `dialog*`, `trayUpdate`, `notificationShow`, `watcherRestart`, `geoipLookup`, `onMenuEvent`). Shared code must check optional methods before calling them.

Two access paths to the same instance, both initialised at startup by each shell:

- `api-store.ts` — module-level singleton (`initPlatformApi` / `getPlatformApi`), used by the stores.
- `api-context.tsx` — React context (`ApiProvider`), used by components.

| Implementation | File | Storage | RPC transport |
|---|---|---|---|
| Electron | `src/renderer/electron-api.ts` | `config.json` in Electron `userData` (`src/main/store/config-store.ts`; passwords encrypted with `safeStorage`, never sent to the renderer) | IPC to main |
| Web | `apps/web/src/lib/web-api.ts` | `localStorage` (`apps/web/src/lib/web-storage.ts`) + sealed active-server cookie | Server actions |

Every method returns `IpcResponse` (`{ success, data?, error? }`) — failures are returned, not thrown.

## RPC data flow

**Electron**

```
component / store
  → PlatformApi (electron-api.ts)
  → window.api (preload.ts, contextBridge)
  → ipcRenderer.invoke(IPC.RPC_*)
  → ipcMain.handle, wrapped by guardHandler (src/main/security/ipc-guard.ts):
      sender origin check, then zod validation (src/main/security/schemas.ts)
  → handler (src/main/ipc/rpc-handlers.ts)
  → connectionManager.getActiveClient() (src/main/rpc/connection-manager.ts)
  → TransmissionRpcClient.request (src/main/rpc/client.ts)
  → Transmission daemon
```

Both the sender check and the argument schemas run before any handler code; failures return an `IpcResponse` error. The main-process client owns the `X-Transmission-Session-Id` handshake (409 → retry once), Basic auth, and optional HTTP / SOCKS5 proxy agents.

**Web**

```
component / store
  → PlatformApi (web-api.ts)
  → server action rpcRequest (apps/web/src/lib/server-actions/rpc.ts)
      client rate limit → validate method and args (server/schemas.ts)
  → readActiveServer: unseal the session cookie (server/active-session.ts, session-cookie.ts)
  → callTransmission (server/transmission.ts): Basic auth, 409 session-id handshake, deadline
  → postJson (server/outbound.ts): resolve once, classify every address (address-policy.ts),
      destination rate limit, connect to a validated address
  → Transmission daemon
```

The Next.js server is the proxy: the daemon must be reachable **from the server**, not from the user's browser. Server actions are public endpoints, so each one validates its input and applies the host guard on every outbound request; the cookie only carries the target. When the cookie is missing or expired, the action returns the code `NO_SESSION` and `web-api.ts` re-seals it from `localStorage` and retries once. Failures return a fixed error code (`server/errors.ts`). Session IDs are cached in a bounded in-memory map per server instance. Proxy settings are not supported on web. Design and rationale: [ADRs 0002 to 0005](decisions/); model and gaps: [security.md](security.md).

## Electron renderer origin and file access

The packaged renderer is not loaded from `file://`. `src/main/index.ts` calls `registerAppScheme()` before `ready` and `serveRendererFrom(rendererRoot)` after it; `src/main/security/app-protocol.ts` loads the renderer build directory into an in-memory manifest once and serves `app://seedora/...` requests from it by exact path lookup. In development the window loads the Vite dev server instead. The IPC sender check, navigation guards and permission handlers all trust the same origin (`TrustedOrigins` in `src/main/security/sender.ts`). Rationale: [ADR 0006](decisions/0006-packaged-renderer-app-scheme.md).

The renderer never supplies a file path that main reads directly. Paths come from dialogs that main opens (`ipc/dialog-handlers.ts`), are recorded per kind in `security/approved-paths.ts`, and are read with `readRegularFile`. `READ_FILE_BASE64`, config import and `torrent-add` with a local file all go through that registry. Details and known gaps: [security.md](security.md).

The CSP is a meta tag injected into `index.html` by `cspPlugin` in `vite.renderer.config.ts` (policy in `src/main/security/csp.ts`).

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

Native menu (`src/main/menu.ts`, sends `menu:*` events to the renderer; the preload only lets the renderer subscribe to channels listed in `RENDERER_EVENT_CHANNELS`), tray (`tray.ts`), watch folder (`watcher.ts`, chokidar), GeoIP lookup (`ipc/handlers.ts`, `geoip-lite`), desktop notifications (`index.ts`), launch handling (`launch/`: `open-url`, `open-file`, argv and `second-instance` feed a queue the renderer pulls with `LAUNCH_TAKE`).

## Aliases

`@shared` resolves to `packages/shared/src` in every build (main, preload, renderer, web, type-check, Vitest). `types.ts` and `key-utils.ts` live only there; main and preload import just those two dependency-free files, so no React or UI code enters the main bundle. `@ipc` resolves to `src/shared` (IPC channel names, main and preload only).

| Alias | Config | Target |
|---|---|---|
| `@shared` | `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`, `vitest.config.ts`, root `tsconfig.json`, `apps/web/tsconfig.json` | `packages/shared/src` |
| `@ipc` | `vite.main.config.ts`, `vite.preload.config.ts`, `vitest.config.ts`, root `tsconfig.json` | `src/shared` |

## Build outputs

| Command | Output |
|---|---|
| `npm start` | Vite dev server for the renderer + main/preload bundles in `.vite/build/` |
| `npm run package` / `make` | `out/` (packaged app, installers in `out/make/`) |
| `npm run build:web` | `apps/web/.next/` (no service worker is generated; `apps/web/public/manifest.json` is static) |

`geoip-lite` is not bundled: it is `external` in `vite.main.config.ts`, copied into the package by `copyExternalModules` in `forge.config.ts`, and unpacked from the asar.
