# Seedora - Project Instructions

## UI Verification (MANDATORY)

After ANY UI change (component, style, layout, dialog), you MUST verify the result visually using the Chrome DevTools MCP tools:

1. Take a screenshot with `mcp__chrome-devtools__take_screenshot` to check the visual output
2. For modal/dialog/dropdown changes: click the trigger button first with `mcp__chrome-devtools__click`, then screenshot
3. Check for console errors with `mcp__chrome-devtools__list_console_messages` if something looks off
4. Use `mcp__chrome-devtools__evaluate_script` to debug CSS/DOM issues
5. Always report what you see to the user

The app runs on `http://localhost:5173/` via Electron with `--remote-debugging-port=9222`.

## Stack

- Electron Forge + Vite 6 + TypeScript 5.7
- React 19 + TailwindCSS v4 + shadcn-style CSS variables
- TanStack Table v8 + @tanstack/react-virtual
- Zustand stores (server, torrent, session, ui)
- i18next for i18n (23 languages)

## Key Conventions

- Main process files: `src/main/`
- Preload: `src/preload/preload.ts` (NOT index.ts — avoids output collision)
- Renderer: `src/renderer/`
- Shared types/IPC channels: `src/shared/`
- All IPC channels defined in `src/shared/ipc-channels.ts`
- ESM-only packages (chokidar, etc.) must use dynamic `import()` in main process or be marked `external` in vite.main.config.ts (e.g. geoip-lite)

## i18n (MANDATORY)

**Every user-facing string** MUST use `t('section.key')` from `react-i18next` — no hardcoded strings in components.

When adding or modifying an i18n key, you MUST add the translated value to **ALL 23 locale files** in `src/renderer/locales/` (en, fr, de, es, it, pt, nl, pl, cs, ru, uk, tr, ar, ja, ko, zh, da, nb, sv, fi, hu, ro, el). Each file must contain the **actual translation** in that language, not the English fallback. Use `/i18n-strings` for the full workflow details.
