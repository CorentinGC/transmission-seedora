# MEMORY — Seedora

> Working memory. READ before coding, UPDATE when a task changes the state. Keep it under 150 lines. Stable documentation lives in `docs/` (index: `llms.txt`); the backlog lives in beads (`bd ready`).

## Current state (2026-11-16)

- **Everything is delivered to `main`**: phases 1-4 of the overhaul (agentic setup, repo cleanup, security hardening, i18n, accessibility, landing / app subdomain / SEO), then the macOS keychain fix (release **1.4.2**, 6 installers). `main` and `staging` are in sync, no pull request is open, and the beads backlog is empty (185 issues, all closed).
- The project runs on **Node 24**. `seedora.app` serves the landing (EN/FR), `app.seedora.app` the web app, `www` redirects (host proxy `apps/web/src/proxy.ts`, ADR 0008). Search Console domain property is verified with `sitemap.xml` submitted.
- **macOS keychain**: the packaged app is re-signed ad hoc after packaging (`tools/macos-adhoc-sign.ts`, `postPackage` hook in `forge.config.ts`) so `safeStorage` works; a refusal surfaces as the translated `SECRET_STORE_FAILED` / `CONFIG_UNWRITABLE` errors. Developer ID signing and notarisation need owner secrets and stay documented in `docs/release.md` and the README.
- Gates (typecheck, lint, test, i18n:check, format:check, build:web) are green; baseline below.

## Next steps

Nothing is open in the backlog. New work starts from `bd ready` and the GitHub Issues inbox.

### Owner actions (cannot be done from the repo)

1. First launch of the installed 1.4.2 on the owner's machine: it encrypts the cleartext server password still stored in the real `config.json` (`migrateLegacySecrets`, verified on a copy of that config, not yet on the real one). Click "Always Allow" if macOS asks about "Seedora Safe Storage".
2. Three `gh` commands in `docs/release.md` ("Self-hosted runner on a public repository" and "Community settings"): require approval for all external contributors on fork PR workflows, enable private vulnerability reporting, create the `translation` label.
3. Create the Vercel firewall rate-limit rule for server actions (command in `docs/security.md`, "Platform rate limiting"). Confirm the plan allows rate limiting first.

## Gate baseline (re-measured 2026-11-15 on `chore/repo-cleanup`)

- `npm run typecheck`: passes (root and `apps/web`).
- `npm test`: passes, 68 files, 1158 tests.
- `npm run lint`: 0 errors, 25 warnings.
- `npm run i18n:check`: passes, 23 locales in sync (491 keys in `en.json`).
- `npm run format:check`: passes after the repo-wide Prettier commit (`00q`).
- `npm run build:web`: passes.
- CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests, i18n parity, web build and a Linux package smoke test on pull requests. Every job is blocking (`continue-on-error` is gone). A `commitlint` job checks the PR title and commits.
- `npm audit`: triaged 2026-11-15, 64 to 52 after non-breaking fixes; then Electron 45.3.2 and Forge 8 / Vite 8 / sharp 0.35 cleared the Electron, `tar` and Forge-chain advisories. Remaining audit items: `appdmg` / `image-size`, `typescript-eslint` / `minimatch`, `geoip-lite` is on 2.0.3 since the Node 24 move. Details: `docs/dependency-audit.md`.

## Dependency state (2026-11-15)

- Electron 45.3.2 (exact pin), Electron Forge 8, Vite 8, sharp 0.35, Next 16. `engines.node` is `>=24`; `.nvmrc`, the CI setup action and the release workflow use 24.
- `@ducanh2912/next-pwa` is gone (`0yd`): it never produced a service worker under Next 16 Turbopack. The manifest is static; there is no offline mode. A real service worker is a separate issue (`0nw`, mind ADR 0007).
- `safeStorage` uses the async API (`isAsyncEncryptionAvailable`, `encryptStringAsync`, `decryptStringAsync`; the sync methods go away in Electron 46, `fu8` done). `configStore.init()` (awaited at `ready`) caches decrypted secrets for the synchronous readers; every store mutator is async and must be awaited. Verified on the real login keychain with the published 1.4.2 zip (add, restart, clear password).
- Open audit items: `appdmg` / `image-size`, `typescript-eslint` / `minimatch`. See `docs/dependency-audit.md`.

## Recent decisions

- 2026-11-15 — Licence is **MIT** (`LICENSE` replaced on `chore/repo-cleanup`).
- 2026-11-15 — Backlog in **beads**; GitHub Issues stay the public inbox, mirrored by `product-owner`.
- 2026-11-15 — Everything found in review gets fixed in this overhaul, not deferred.
- 2026-11-15 — Web SSRF design: default-deny loopback/private/link-local addresses with `SEEDORA_ALLOW_PRIVATE_HOSTS` opt-in for LAN self-hosting (metadata addresses always denied), optional `SEEDORA_ALLOWED_HOSTS`. Sealed cookie via iron-session, static CSP. See ADRs 0002-0005.
- 2026-11-15 — The committed localhost dev key is removed from the tree and ignored; public history is not rewritten for it.
- 2026-11-15 — Tracked agent and project files are written in English (community-facing).

## Gotchas

- `@shared` is `packages/shared/src` in every build; `@ipc` is `src/shared` (IPC channel names). Main imports only `types` and `key-utils` from `@shared`: keep them dependency-free.
- `useMenuEvents` exists twice (`src/renderer/hooks/` and `packages/shared/src/hooks/`); check which one is imported before editing.
- Adding a language touches three places: the locale file, `packages/shared/src/locales/index.ts` (the registry), `LANGUAGE_NAMES` in `packages/shared/src/lib/i18n-utils.ts`. The main process discovers locale files by itself. Menu, tray and native dialogs read the `native` section (`src/main/i18n/main-i18n.ts`).
- Filters live in `torrent-store`, not `ui-store`.
- `bd list --json` prints a tree; use `bd list --flat --json --limit 0`. bd owns `core.hooksPath` (`.beads/hooks`) — Husky must chain with it.
- release-please ships a version for any `fix:`/`feat:` reaching `main`; choose commit types deliberately.
- `packages/shared/package.json` points `main`/`types` at a non-existent `src/index.ts`; imports work only through aliases.
- Local-only backup tags `backup/local-staging-2026-11-15` and `backup/local-main-2026-11-15` hold the pre-realignment history. Never push them (they carry a personal author email).
- Electron debugging for agents: `chrome-devtools` MCP on port 9222; web: `chrome-devtools-web`. The main session may start the apps in the background (and stops them after); subagents never do.

- The packaged renderer's origin is `app://seedora`, not `file://`. Renderer-only `localStorage` from older builds resets once. Never trust a `file:` URL in `sender.ts`, never add `corsEnabled`/`bypassCSP` to the scheme.
- `configStore.getServers()` returns decrypted passwords: main-process use only. Anything sent to the renderer goes through `toPublicServer`. `safeStorage` works only after `ready`, so the store is first used there (`await configStore.init()` first).
- A new IPC channel needs: constant in `src/shared/ipc-channels.ts`, zod schema in `security/schemas.ts`, a `handleGuarded` registration, a preload method, a `PlatformApi` entry; renderer-bound events also go in `RENDERER_EVENT_CHANNELS`.

## Pointers

Architecture `docs/architecture.md` · Security model and known gaps `docs/security.md` · Release `docs/release.md` · i18n `docs/i18n.md` · Team and workflow `AGENTS.md`
