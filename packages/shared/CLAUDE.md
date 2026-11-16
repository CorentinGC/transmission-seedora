# packages/shared — the shared UI (`@seedora/shared`)

All of Seedora's UI. Consumed by the Electron renderer and the web app through the `@shared/*` alias — both must keep working after every change here.

## What lives where (`src/`)

- `components/ui/` — primitives (`Button`, `Input`, `Select`, `Checkbox`, `Dialog`, `Tabs`, `Field`, …), exported from `ui/index.ts`
- `components/{layout,filter,torrent,details,server,settings}/` — feature components
- `stores/` — Zustand stores (`server`, `torrent`, `session`, `ui`)
- `hooks/`, `lib/` (formatting, bencode parser, i18n), `types/`
- `platform/` — `PlatformApi` interface, singleton (`api-store.ts`) and context (`api-context.tsx`)
- `locales/` — 23 translation files; `globals.css` — theme tokens

## Rules

1. **No platform imports.** Nothing from `electron`, `node:*` or `next/*`. No `window.api`, no `import.meta.glob` (locales are registered statically in `locales/index.ts`, the single registry for every host).
2. **Everything platform-specific goes through `PlatformApi`.** Optional methods (`dialogOpenFile?`, `trayUpdate?`, …) are absent on web: check before calling and provide a fallback.
3. **Check `res.success`.** `PlatformApi` returns `IpcResponse`; it does not throw. Surface failures to the user.
4. **Every string through `t()`**, with the key added and truly translated in all 23 locales — see `docs/i18n.md`, then run `npm run i18n:check`.
5. **Accessibility on every interactive element:** keyboard-operable, visible focus, accessible name (`aria-label` on icon-only buttons). Dialogs use `ui/Dialog`.
6. **Theme tokens only** — no raw Tailwind palette colours. Check light and dark.
7. Daemon-supplied text (torrent, file, tracker, peer names) is rendered as text, never as HTML or a link target.

`types.ts` and `key-utils.ts` live only in `packages/shared/src` and are also imported by the main process through `@shared`: keep them free of imports and of React, DOM or Node APIs.
