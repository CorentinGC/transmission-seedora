# src/main — Electron main process

The trusted side of the desktop app: it holds credentials and has file system and network access. Everything it receives from the renderer is untrusted.

## What lives where

- `index.ts` — app lifecycle (the single-instance lock is claimed first, before any handler is registered), `BrowserWindow`, tray / notification / watcher IPC listeners
- `ipc/` — `handlers.ts` (registration, GeoIP), `config-handlers.ts` (servers, prefs, import/export), `dialog-handlers.ts` (native dialogs, approved-file read), `rpc-handlers.ts` (Transmission RPC)
- `security/` — `ipc-guard.ts` (sender check + zod validation wrapper for every handler), `schemas.ts`, `sender.ts`, `approved-paths.ts` (paths returned by main-opened dialogs, `readRegularFile`), `torrent-source.ts` (`readApprovedTorrent`, the only torrent file reader), `watch-folder.ts` (watch folder revalidation, safe watched-file read), `strip-undefined.ts`, `fuses.ts` (fuse map used by `forge.config.ts`), `window-guards.ts`, `csp.ts`, `app-protocol.ts` (`app://` manifest builder, URL resolver, handler), `app-scheme.ts` (scheme registration)
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
7. Never weaken `webPreferences` or the fuses (`security/fuses.ts`; `GrantFileProtocolExtraPrivileges` is off, a test pins the map).
8. **Approvals are per kind.** `approved-paths.ts` records `torrent`, `json`, `directory` and `watch-folder`; an approval is valid only for the kind of dialog that produced it. `watchFolder` in `PREFS_SET` needs a `watch-folder` approval (dialog opened with `dialogOpenDirectory({ purpose: 'watch-folder' })`); a backup import never sets it.
9. **Read approved or watched files (never renderer assets) only through `readRegularFile`** (open `O_RDONLY|O_NOFOLLOW`, `fstat` and bounded read on one descriptor). No `statSync` then `readFileSync`. The watcher skips symlinks, caps files at 10 MB and revalidates the stored folder at startup.
10. **Patches never carry `undefined`.** `SERVER_UPDATE` / `PREFS_SET` schemas and the config store strip explicit `undefined` keys before merging.
11. **Server `host` is a hostname, IPv4 or `[IPv6]` literal; `path` matches `^/[A-Za-z0-9._~/-]*$`** (both are interpolated into the RPC URL). `torrent-add` `filename`: remote sources pass through, an absolute local path or `file:` URL goes through the approved reader, a relative name passes through to the daemon.
12. **Packaged build:** no DevTools menu item, no DevTools window. The renderer is served from the privileged `app://seedora` scheme (`security/app-protocol.ts`: at `ready` the renderer build dir is walked once and every allow-listed file (html/js/css, symlinks skipped) is read with `fs.readFileSync` into an immutable in-memory manifest; requests are an exact key lookup, GET/HEAD only, nothing is read from disk per request; every response, 404/405 included, carries the CSP plus `frame-ancestors 'none'`) so CSP `'self'` is a real origin and `file://` is unreachable. Trust is by origin (`app://seedora`, dev server in dev); **no `file:` URL is ever trusted**. Never add `corsEnabled` / `bypassCSP` to the scheme and never serve from `file:` again.

Read `docs/security.md` (known gaps) before changing `ipc/`, `store/` or window creation.
