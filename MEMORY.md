# MEMORY — Seedora

> Working memory. READ before coding, UPDATE when a task changes the state. Keep it under 150 lines. Stable documentation lives in `docs/` (index: `llms.txt`); the backlog lives in beads (`bd ready`).

## Current state (2026-11-15)

- Project resumed after an 8-month pause (last release 1.2.1, 2026-03-05). Overhaul in phases: (1) agentic setup, (2) repo cleanup and community readiness, (3) full review with fixes.
- **Phase 1 done**: `CLAUDE.md`, `AGENTS.md`, nested `CLAUDE.md`, `docs/`, `llms.txt`, 12 agents, 3 skills, tracked `.claude/settings.json`, `scripts/i18n-check.mjs`, beads backlog (exported to `.beads/issues.jsonl`).
- **Phase 2 mostly done** on `chore/repo-cleanup`: MIT licence, README and community files, Vitest, ESLint 9 flat config (`mi9.10` closed) and Prettier, CI/CodeQL/Dependabot on the self-hosted `helmut` runner (`we5.4`, `we5.6` in progress).
- **Phase 3, web hardening done, pending the final security audit**: sealed cookie, SSRF guard, validated actions, rate limits, security headers (ADRs `docs/decisions/0002`-`0005`, `0007`, epic `c07`).
- **Phase 3, Electron hardening done, pending the audit** (epic `23u`, ADR `docs/decisions/0006`): sandbox, strict CSP meta, navigation/permission guards, single-instance lock, zod validation and sender check on every IPC channel, approved-path registry, `app://seedora` renderer, preload event allowlist. Since the last update: passwords encrypted with `safeStorage` (cleartext fallback with a UI warning and migration), atomic `0600` config writes, corrupt-config handling, no passwords sent to the renderer, stored-credential reuse rule, script-setting confirmation, export-with-passwords written by main, `magnet:` / `.torrent` launch targets, main-process i18n. Details: `docs/security.md`. Verified in one packaged build (macOS) before these last changes: `file://` blocked, traversal 404, POST 405, unapproved read refused; the credential and launch work is covered by unit tests, not by a packaged-build run.
- **i18n**: all 23 locales are in sync (`i18n:check` passes, 491 keys), including the `native` section used by the main process.
- **`mi9.7` (deduplicate shared types and `key-utils`, unify the `@shared` alias) is in progress in another session.** Do not describe it as done; the `@shared` and duplicate-file gotchas below stay true until it lands.
- **All of this is in local commits on `chore/repo-cleanup`, not pushed.** Do not push or open a PR without the user's go-ahead; `staging` and `main` still carry the old web code.

## Next steps

- [ ] Final `security-auditor` pass on the web hardening, then close `c07.10` and `c07.7`.
- [ ] Final `security-auditor` pass on the Electron hardening (including credentials, script guard, launch targets), then close the finished `23u.*` issues and `0mk`.
- [ ] Electron open: `23u.12` (launch handling is in the code; the issue stays open until a packaged build is checked on each OS), `2df` (packaged verification on Windows and Linux).
- [ ] Remaining web items: `c07.17` (nonce CSP, decided against, ADR 0007), `46b` (rate-limit shared-key lockout), `d9w` (confirm 60 s server actions on Vercel), tests `c07.3`, `c07.11`-`c07.15`.
- [ ] Verify on Vercel (unconfirmed): which forwarding header is overwritten, function max duration above 30 s, CSP violations in a real browser, pinned HTTPS connections (SNI, certificate) against a real TLS server.
- [ ] Phase 3 continued: finish `mi9.7` (other session), bugs `0cl`, a11y/design `vpz`.
- [ ] Phase 4 (after 2-3), epic `52c`: landing page on `seedora.app`, web app moved to `app.seedora.app`, landing SEO, Google Search Console. Hosting **Vercel**; DNS **Cloudflare** (user decision 2026-11-15). **Landing is pending the owner's confirmation; do not start it.**
- [ ] Deploying the new web code needs `COOKIE_SECRET` (>= 32 characters) set on the host first, or the server will not start in production (`apps/web/.env.example`).
- [ ] Visual review pass (`vpz.10`) needs the main session to start Electron (`npm run start:debug`) and web (`npm run dev:web`).

### Owner actions (cannot be done from the repo)

1. Three `gh` commands in `docs/release.md` ("Self-hosted runner on a public repository" and "Community settings"): require approval for all external contributors on fork PR workflows, enable private vulnerability reporting, create the `translation` label.
2. Create the Vercel firewall rate-limit rule for server actions (command in `docs/security.md`, "Platform rate limiting"; `c07.18`). Confirm the plan allows rate limiting first.
3. Decide on Node 24 (`gt3`): `geoip-lite@2.0.3`, which fixes the `ip-address` advisories, requires Node >=24 while the project targets >=22.12 (CI, web hosting, contributors).
4. Confirm the landing epic `52c` before it starts.

## Gate baseline (re-measured 2026-11-15 on `chore/repo-cleanup`)

- `npm run typecheck`: passes (root and `apps/web`).
- `npm test`: passes, 68 files, 1158 tests.
- `npm run lint`: 0 errors, 25 warnings.
- `npm run i18n:check`: passes, 23 locales in sync (491 keys in `en.json`).
- CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests, i18n parity, web build and a Linux package smoke test on pull requests. Only the format check is `continue-on-error` (until `00q`); i18n parity is green and enforced. A `commitlint` job checks the PR title and commits.
- `npm audit`: triaged 2026-11-15, 64 to 52 after non-breaking fixes and Electron 40.10.6 (prod path 9, none reachable at runtime except the Electron advisories that need a 41/42 major). Details: `docs/dependency-audit.md`.

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
- `configStore.getServers()` returns decrypted passwords: main-process use only. Anything sent to the renderer goes through `toPublicServer`. `safeStorage` works only after `ready`, so the store is first used there.
- A new IPC channel needs: constant in `src/shared/ipc-channels.ts`, zod schema in `security/schemas.ts`, a `handleGuarded` registration, a preload method, a `PlatformApi` entry; renderer-bound events also go in `RENDERER_EVENT_CHANNELS`.

## Pointers

Architecture `docs/architecture.md` · Security model and known gaps `docs/security.md` · Release `docs/release.md` · i18n `docs/i18n.md` · Team and workflow `AGENTS.md`
