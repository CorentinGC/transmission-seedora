# Seedora — project instructions

@AGENTS.md

Seedora is a cross-platform remote GUI for the Transmission BitTorrent daemon: one shared React UI shipped as an Electron desktop app and as a Next.js web app (PWA). Open source, MIT.

Before any task, read `MEMORY.md` (current state) and `llms.txt` (index of `docs/`). The directory you work in may have its own `CLAUDE.md` (`src/main/`, `packages/shared/`, `apps/web/`).

## Stack

- Electron 40 (Electron Forge + Vite 6) · Next.js 16 (App Router, Turbopack, PWA) · TypeScript 5.7 strict
- React 19 · Tailwind CSS v4 with shadcn-style CSS variables · lucide-react
- TanStack Table v8 + @tanstack/react-virtual · Zustand stores (server, torrent, session, ui)
- i18next / react-i18next, 23 languages
- npm workspaces (`packages/*`, `apps/*`); the Electron app is the root package

## Layout

| Path | What |
|------|------|
| `src/main/` | Electron main process: IPC handlers (`ipc/`), RPC client (`rpc/`), config store (`store/`), menu, tray, watch folder |
| `src/preload/preload.ts` | contextBridge exposing `window.api` (NOT `index.ts` — avoids an output collision) |
| `src/renderer/` | thin Electron shell: `App.tsx`, `main.tsx`, `electron-api.ts`, two hooks |
| `src/shared/` | code shared by main and preload; all IPC channel names in `ipc-channels.ts` |
| `packages/shared/src/` | `@seedora/shared` — the whole UI: `components/`, `stores/`, `hooks/`, `lib/`, `platform/`, `locales/`, `types/`, `globals.css` |
| `apps/web/` | `@seedora/web` — Next.js app: `src/app/`, `src/lib/web-api.ts`, `src/lib/server-actions/` |
| `docs/` | architecture, setup, conventions, security, i18n, release, ADRs |

The UI never talks to a platform directly: it goes through `PlatformApi` (`packages/shared/src/platform/api-types.ts`), implemented by `src/renderer/electron-api.ts` (IPC) and `apps/web/src/lib/web-api.ts` (localStorage + server actions).

`@shared` resolves to `packages/shared/src` in every build; `@ipc` resolves to `src/shared` (IPC channel names, main and preload only).

## Commands

| Goal | Command |
|------|---------|
| Install | `npm ci` |
| Type-check (root + web) | `npm run typecheck` |
| Lint | `npm run lint` |
| i18n parity | `npm run i18n:check` |
| Build web | `npm run build:web` |
| Package Electron | `npm run package` |
| Backlog | `bd ready`, `bd list --flat --json --limit 0` |

Run the gates that apply before reporting a task as done, and report their real output.

## Running the apps

The main session may start the Electron app (`npm run start:debug`) and the web server (`npm run dev:web`) in the background to verify a change (owner decision, 2026-11-15), and must stop them when done. Subagents never start them: the main session starts the app and hands them the URL or port.

## UI verification (MANDATORY)

After ANY UI change (component, style, layout, dialog, menu, theme token), verify the result in the running app before calling it done — follow the `verify-ui` skill.

| App | Started by the user with | MCP server | Target |
|-----|--------------------------|------------|--------|
| Electron | `npm run start:debug` | `chrome-devtools` | attaches to `127.0.0.1:9222`, renderer at `http://localhost:5173/` |
| Web | `npm run dev:web` | `chrome-devtools-web` | isolated browser on the Next dev URL |

Screenshot the changed state (open the dialog/menu first), check the console, check light and dark themes, and report what you actually saw. Shared UI is verified in both apps. If you could not verify, say so.

## i18n (MANDATORY)

Every user-facing string uses `t('section.key')` — components, notifications, errors shown to the user; the native menu and tray are hardcoded English until main-process i18n lands (`k5r`). A new or changed key goes into **all 23** files in `packages/shared/src/locales/` with a **real translation**, never the English fallback. `npm run i18n:check` must pass. Workflow: `i18n-strings` skill; details: `docs/i18n.md`.

## Security (MANDATORY)

- The Electron renderer and every caller of a Next.js server action are untrusted. Validate on the trusted side (main process, server), every argument, every time.
- IPC: channel names in `src/shared/ipc-channels.ts`; no renderer-supplied file path reaches `fs` unless it came from a dialog opened by main.
- Web: server actions are public endpoints; outbound requests must go through the host guard (not implemented yet, `docs/security.md`, issue `c07.2`); credentials are never stored or sent unencrypted, never logged.
- Do not weaken `BrowserWindow` options, the CSP, security headers or Electron fuses.
- Model and known gaps: `docs/security.md`. Changes in these areas get a `security-auditor` pass.

## Code conventions

- TypeScript strict; no `any`, no `@ts-ignore`; validate external data instead of casting it.
- DRY and single responsibility: look for the existing helper, primitive or store action before writing a new one. Split a file before it reaches 500 lines.
- Explicit names; early returns; no dead or commented-out code; no `TODO` without a beads ID.
- Errors are handled or surfaced, never swallowed. Network calls have timeouts.
- UI: build from `packages/shared/src/components/ui`; colours from the theme tokens in `globals.css`, not raw Tailwind palette classes; every interactive element is keyboard-operable and has an accessible name.
- `packages/shared` imports nothing from Electron, Node or Next.
- ESM-only packages (chokidar…) in the main process use dynamic `import()` or are marked `external` in `vite.main.config.ts` (e.g. `geoip-lite`).
- New logic comes with a test; a bug fix starts with a failing test.
- Exported functions and files carry a short JSDoc. Code, comments, docs and commit messages are in English.

Details: `docs/conventions.md`.

## Git and releases

- Flow: branch from `staging` → PR to `staging` → PR `staging` → `main`. Never commit directly to `staging` or `main`.
- Conventional Commits are required: release-please turns every `fix:` / `feat:` / `perf:` that reaches `main` into a release. Use `chore:`, `docs:`, `ci:`, `test:`, `refactor:`, `build:` for work that should not ship a version.
- Never push, open a PR, tag or publish without the user's explicit go-ahead. Never hand-edit `CHANGELOG.md` or version fields.
- Details: `docs/release.md`.

## Keeping the knowledge current

- `MEMORY.md`: update state, next steps and gotchas when a task changes them.
- `docs/` and `llms.txt`: update when architecture, a convention, the security model or the release process changes. Record lasting decisions as ADRs in `docs/decisions/`.
