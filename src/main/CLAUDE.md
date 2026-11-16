# src/main — Electron main process

The trusted side of the desktop app: it holds credentials and has file system and network access. Everything it receives from the renderer is untrusted.

## What lives where

- `index.ts` — app lifecycle (the single-instance lock is claimed first, before any handler is registered), `BrowserWindow`, tray / notification / watcher IPC listeners
- `ipc/` — `handlers.ts` (registration, GeoIP), `config-handlers.ts` (servers, prefs, import/export), `dialog-handlers.ts` (native dialogs, approved-file read), `rpc-handlers.ts` (Transmission RPC, `session-set` script guard), `script-confirm-dialog.ts` (native confirmation for `script-torrent-*` changes)
- `security/` — `ipc-guard.ts` (sender check + zod validation wrapper for every handler), `schemas.ts`, `sender.ts`, `approved-paths.ts` (paths returned by main-opened dialogs, `readRegularFile`), `torrent-source.ts` (`readApprovedTorrent`, the only torrent file reader), `watch-folder.ts` (watch folder revalidation, safe watched-file read), `strip-undefined.ts`, `fuses.ts` (fuse map used by `forge.config.ts`), `window-guards.ts`, `csp.ts`, `app-protocol.ts` (`app://` manifest builder, URL resolver, handler), `app-scheme.ts` (scheme registration), `script-guard.ts` (decides whether a `session-set` touching script settings may proceed), `external-urls.ts` (`releaseNotesUrl`, hardcoded GitHub URL builder for the Help menu), `server-credentials.ts` (`toPublicServer`, `withoutSecrets`, `withSecrets`, `sameEndpoint`, `resolveTestServer`)
- `rpc/` — `client.ts` (`TransmissionRpcClient`: session-id handshake, auth, proxy), `connection-manager.ts`, `to-ipc-error.ts` (`toIpcError`: any thrown error to a renderer-safe `IpcResponse`)
- `store/` — `config-store.ts` (`config.json` in `userData`; passwords sealed with `safeStorage`), `secret-crypto.ts` (`SecretCrypto`, the async `safeStorage` wrapper: `isAsyncEncryptionAvailable` / `encryptStringAsync` / `decryptStringAsync`; the sync API is removed in Electron 46), `atomic-write.ts` (`writeFileAtomic`, mode 0600)
- `launch/` — `launch-targets.ts` (validates a magnet URI or `.torrent` path from the OS), `launch-queue.ts` (holds targets until the renderer pulls), `launch-handlers.ts` (`open-url`, `open-file`, argv, `LAUNCH_TAKE`)
- `i18n/main-i18n.ts` — `t()` over the `native` section of the shared locale files, for the menu, tray and native dialogs
- `menu.ts`, `tray.ts`, `watcher.ts`

Related: `src/preload/preload.ts` (the `window.api` bridge), `src/shared/ipc-channels.ts` (channel names, alias `@ipc/ipc-channels`).

## Rules

1. **The renderer is untrusted.** Validate every IPC argument at runtime — type, shape, bounds — before using it. TypeScript annotations on handler parameters prove nothing.
2. **No renderer-supplied path, URL or host is used as-is.** File reads and writes only for paths the user picked in a native dialog; external URLs only from a hardcoded list.
3. **Every channel is a constant in `src/shared/ipc-channels.ts`.** No string literals in `ipcMain` or `webContents.send`. A new channel also needs its preload method and `PlatformApi` entry.
4. **Handlers return `IpcResponse`** (`{ success, data?, error? }`) and never leak credentials or raw stack traces in `error`.
5. **ESM-only dependencies** are loaded with dynamic `import()`; modules that cannot be bundled are `external` in `vite.main.config.ts` and copied in `forge.config.ts`.
6. `@shared` is `packages/shared/src` (import only `types` and `key-utils` from main; never UI code); IPC channels come from `@ipc/ipc-channels` — see `docs/architecture.md`.
7. Never weaken `webPreferences` or the fuses (`security/fuses.ts`; `GrantFileProtocolExtraPrivileges` is off, a test pins the map).
8. **Approvals are per kind.** `approved-paths.ts` records `torrent`, `json`, `directory` and `watch-folder`; an approval is valid only for the kind of dialog that produced it. `watchFolder` in `PREFS_SET` needs a `watch-folder` approval (dialog opened with `dialogOpenDirectory({ purpose: 'watch-folder' })`); a backup import never sets it.
9. **Read approved or watched files (never renderer assets) only through `readRegularFile`** (open `O_RDONLY|O_NOFOLLOW`, `fstat` and bounded read on one descriptor). No `statSync` then `readFileSync`. The watcher skips symlinks, caps files at 10 MB and revalidates the stored folder at startup.
10. **Patches never carry `undefined`.** `SERVER_UPDATE` / `PREFS_SET` schemas and the config store strip explicit `undefined` keys before merging.
11. **Server `host` is a hostname, IPv4 or `[IPv6]` literal; `path` matches `^/[A-Za-z0-9._~/-]*$`** (both are interpolated into the RPC URL). `torrent-add` `filename`: remote sources pass through, an absolute local path or `file:` URL goes through the approved reader, a relative name passes through to the daemon.
12. **Packaged build:** no DevTools menu item, no DevTools window. The renderer is served from the privileged `app://seedora` scheme (`security/app-protocol.ts`: at `ready` the renderer build dir is walked once and every allow-listed file (html/js/css, symlinks skipped) is read with `fs.readFileSync` into an immutable in-memory manifest; requests are an exact key lookup, GET/HEAD only, nothing is read from disk per request; every response, 404/405 included, carries the CSP plus `frame-ancestors 'none'`) so CSP `'self'` is a real origin and `file://` is unreachable. Trust is by origin (`app://seedora`, dev server in dev); **no `file:` URL is ever trusted**. Never add `corsEnabled` / `bypassCSP` to the scheme and never serve from `file:` again.

13. **Passwords never go to the renderer.** Every server returned over IPC passes through `toPublicServer` (flags `hasPassword` / `hasProxyPassword` only). `configStore.getServers()` returns decrypted passwords: main-process use only. Reads are synchronous (decrypted values are cached in memory by `configStore.init()`, awaited at `ready` before anything reads the store); every mutator returns a Promise and must be awaited, because persisting encrypts asynchronously. Encryption failure while a secret store exists rejects the write (fail closed, nothing is written); a password that cannot be decrypted stays locked and its ciphertext is never overwritten.
14. **A stored password follows only an unchanged endpoint.** `resolveTestServer` and `configStore.updateServer` use `sameEndpoint` / `sameProxy`; a password is never reused when the host, port, path, TLS or proxy changed, or when `allowSelfSigned` was newly enabled. Do not bypass them.
15. **Persist with `writeFileAtomic`** (temp file mode 0600, `fsync`, rename), never `writeFileSync` on a user file. A config that is invalid is moved aside; one that is unreadable disables writes (`ConfigStoreError`) rather than being overwritten.
16. **Errors for the renderer go through `toIpcError`.** An `RpcError` message is credential-free by construction; anything else becomes `Request failed`. Log `err.name`, never the message or the object.
17. **`session-set` goes through `isSessionChangeAllowed`.** Changes to the six `script-torrent-*` keys need a native confirmation (`confirmScriptChanges`); the check and the write use the same client captured once. Export with passwords is confirmed and written by main; secrets never cross IPC.
18. **Launch targets are validated in `launch/launch-targets.ts`** (magnet URI with a btih/btmh hash, or a `.torrent` path; UNC and device paths refused on win32). A `.torrent` path is approved as kind `torrent` by main, then read like a dialog selection. Register `registerLaunchHandling` before `ready`.
19. **Native strings use `t('native.…')`** from `i18n/main-i18n.ts`; the keys live in the shared locale files (all 23) and `npm run i18n:check` covers them. No hardcoded English in menu, tray or native dialogs.

Read `docs/security.md` (known gaps) before changing `ipc/`, `store/` or window creation.
