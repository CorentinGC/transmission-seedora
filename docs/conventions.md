# Conventions

## TypeScript

- `strict` everywhere (root `tsconfig.json`, `apps/web/tsconfig.json`). No `any`, no `@ts-ignore`; if one is unavoidable, scope it to one line with a comment explaining why.
- Type every boundary: IPC payloads, server-action arguments, RPC responses. Data crossing a process or network boundary is validated at runtime, not just typed.
- Prefer `IpcResponse<T>` results over thrown errors across the `PlatformApi` boundary, and **check `success`** on the caller side.

## Files and naming

- One responsibility per file. Warn at 400 lines, split at 500.
- Components: `PascalCase.tsx`, one exported component per file. Hooks: `useThing.ts`. Stores: `thing-store.ts`. Other modules: `kebab-case.ts`.
- Explicit names; booleans start with `is` / `has` / `can` / `should`.
- Early returns over nested conditionals. No commented-out code, no unused exports.
- Code lives next to its only consumer; it moves to `packages/shared/src/lib` or `components/ui` once it has two.

## Where code goes

| Kind of code | Location |
|---|---|
| UI, stores, hooks, formatting, types used by the UI | `packages/shared/src/` |
| Anything using Electron or Node APIs | `src/main/`, `src/preload/` |
| Electron-specific renderer glue | `src/renderer/` |
| Anything using Next.js APIs, server actions | `apps/web/src/` |

`packages/shared` must not import from `electron`, `node:*`, or `next/*`. Platform differences go through `PlatformApi` (see [architecture.md](architecture.md)).

## IPC

- Every channel name is a constant in `src/shared/ipc-channels.ts` (`IPC.*`). No string literals in `ipcMain` / `ipcRenderer` calls.
- A new capability means four edits: the channel constant, the handler in `src/main/ipc/`, the method in `src/preload/preload.ts`, and the `PlatformApi` method plus its `electron-api.ts` and `web-api.ts` implementations.
- Handlers treat every argument as untrusted input.

## Main-process dependencies

ESM-only packages (e.g. `chokidar`) are loaded with dynamic `import()` in the main process. Packages that cannot be bundled (e.g. `geoip-lite`) are marked `external` in `vite.main.config.ts` and copied into the package by `forge.config.ts`.

## Tests

- Vitest, configured in `vitest.config.ts` with three projects, one per build target: `main` (`src/main`, `src/preload`, `src/shared`), `shared` (`packages/shared/src`, `src/renderer`) and `web` (`apps/web/src`); all map `@shared` to `packages/shared/src`, and `main` also maps `@ipc` to `src/shared`.
- `npm test` runs everything once; `npm run test:watch` watches. Tests live next to the code as `*.test.ts(x)`.
- No real network, daemon or timers. A bug fix starts with a failing test.

## i18n

Every user-facing string goes through `t('section.key')`. A new key is added to all 23 locale files with a real translation. Full rules: [i18n.md](i18n.md).

## UI

- Build from the primitives in `packages/shared/src/components/ui/` (exported from `ui/index.ts`). Add a primitive there rather than re-implementing a dialog, button or input inline.
- Colours come from the theme tokens defined in `packages/shared/src/globals.css` (`bg-background`, `text-muted-foreground`, `border-border`, `text-destructive`, …). **No raw Tailwind palette colours** (`text-red-500`, `bg-green-500`): they ignore the light/dark theme. If a semantic colour is missing, add a token.
- Every interactive element is reachable and operable by keyboard and has an accessible name (`aria-label` on icon-only buttons). Dialogs use the shared `Dialog`.
- Any UI change is verified visually in the running app, in both light and dark themes.

## Commits and branches

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `ci:`, `chore:`, `style:`. The type drives the changelog and the version bump — see [release.md](release.md).
- Flow: feature branch → PR into `staging` → PR `staging` into `main`. Never commit directly to `main`.
- One logical change per commit; the subject says what changed, the body says why when it is not obvious.
