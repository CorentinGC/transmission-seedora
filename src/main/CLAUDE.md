# src/main — Electron main process

The trusted side of the desktop app: it holds credentials and has file system and network access. Everything it receives from the renderer is untrusted.

## What lives where

- `index.ts` — app lifecycle, `BrowserWindow`, tray / notification / watcher IPC listeners
- `ipc/` — `handlers.ts` (registration, GeoIP), `config-handlers.ts` (servers, prefs, dialogs, import/export), `rpc-handlers.ts` (Transmission RPC)
- `rpc/` — `client.ts` (`TransmissionRpcClient`: session-id handshake, auth, proxy), `connection-manager.ts`
- `store/config-store.ts` — `config.json` in `userData`
- `menu.ts`, `tray.ts`, `watcher.ts`

Related: `src/preload/preload.ts` (the `window.api` bridge), `src/shared/ipc-channels.ts` (channel names).

## Rules

1. **The renderer is untrusted.** Validate every IPC argument at runtime — type, shape, bounds — before using it. TypeScript annotations on handler parameters prove nothing.
2. **No renderer-supplied path, URL or host is used as-is.** File reads and writes only for paths the user picked in a native dialog; external URLs only from a hardcoded list.
3. **Every channel is a constant in `src/shared/ipc-channels.ts`.** No string literals in `ipcMain` or `webContents.send`. A new channel also needs its preload method and `PlatformApi` entry.
4. **Handlers return `IpcResponse`** (`{ success, data?, error? }`) and never leak credentials or raw stack traces in `error`.
5. **ESM-only dependencies** are loaded with dynamic `import()`; modules that cannot be bundled are `external` in `vite.main.config.ts` and copied in `forge.config.ts`.
6. `@shared` resolves to `src/shared` here, not to `packages/shared/src` — see `docs/architecture.md`.
7. Never weaken `webPreferences` or the fuses in `forge.config.ts`.

Read `docs/security.md` (known gaps) before changing `ipc/`, `store/` or window creation.
