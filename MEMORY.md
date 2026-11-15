# MEMORY — Seedora

> Working memory. READ before coding, UPDATE when a task changes the state. Keep it under 150 lines. Stable documentation lives in `docs/` (index: `llms.txt`); the backlog lives in beads (`bd ready`).

## Current state (2026-11-15)

- Project resumed after an 8-month pause (last release 1.2.1, 2026-03-05). Overhaul in phases: (1) agentic setup, (2) repo cleanup and community readiness, (3) full review with fixes.
- **Phase 1 done**: `CLAUDE.md`, `AGENTS.md`, nested `CLAUDE.md`, `docs/`, `llms.txt`, 12 agents, 3 skills, tracked `.claude/settings.json`, `scripts/i18n-check.mjs`, beads backlog (exported to `.beads/issues.jsonl`).
- **Phase 2 mostly done** on `chore/repo-cleanup`: MIT licence, README and community files, Vitest, ESLint 9 flat config and Prettier (`mi9.10` in progress), CI/CodeQL/Dependabot on the self-hosted `helmut` runner (`we5.4`, `we5.6` in progress).
- **Phase 3, web P0 fixes done, pending the final security audit**: sealed cookie, SSRF guard, validated actions, rate limits, security headers (ADRs `docs/decisions/0002`-`0005`, epic `c07`). Docs updated (`c07.16`, `9o7`). **Electron hardening implemented, pending the audit** (epic `23u`, ADR `docs/decisions/0006`): sandbox, strict CSP meta, navigation/permission guards, single-instance lock, zod validation and sender check on every IPC channel, approved-path registry, preload event allowlist, DevTools unpackaged only, fuse `GrantFileProtocolExtraPrivileges` off, renderer served from `app://seedora`. Verified in one packaged build (macOS): `file://` fetch blocked, traversal 404, POST 405, unapproved `readFileBase64` refused.
- **All of this is in local commits on `chore/repo-cleanup`, not pushed.** Do not push or open a PR without the user's go-ahead; `staging` and `main` still carry the old web code.

## Next steps

- [ ] Final `security-auditor` pass on the web hardening, then close `c07.10` and `c07.7`.
- [ ] Final `security-auditor` pass on the Electron hardening (`app-protocol.ts`, `ipc-guard.ts`, `approved-paths.ts`), then close the finished `23u.*` issues and `0mk`.
- [ ] Electron still open: `tva` (passwords returned to the renderer, `SERVER_TEST` by id), `gad` (raw `SERVER_TEST` error), `23u.8`/`23u.9` (`safeStorage`, config permissions, atomic writes), `3kt` (`script-*` confirmation), `23u.12` (`magnet:` and `.torrent` association), `2df` (packaged verification on Windows and Linux).
- [ ] Remaining web items: `c07.8` (plaintext passwords in `localStorage` and exports), `c07.17` (nonce CSP), `c07.18` (Vercel Firewall rule, user action in the dashboard), `46b` (rate-limit shared-key lockout), `099` (upgrade Next past 16.4.0), tests `c07.3`, `c07.11`-`c07.15`.
- [ ] Verify on Vercel (unconfirmed): which forwarding header is overwritten, function max duration above 30 s, CSP violations in a real browser, pinned HTTPS connections (SNI, certificate) against a real TLS server.
- [ ] Phase 3 continued: bugs `0cl`; i18n `k5r` (49 keys missing in 21 locales, `k5r.1`); a11y/design `vpz`.
- [ ] Phase 4 (after 2-3), epic `52c`: landing page on `seedora.app`, web app moved to `app.seedora.app`, landing SEO, Google Search Console. Hosting **Vercel**; DNS **Cloudflare** (user decision 2026-11-15).
- [ ] Deploying the new web code needs `COOKIE_SECRET` (>= 32 characters) set on the host first, or the server will not start in production.
- [ ] Visual review pass (`vpz.10`) needs the user to start Electron (`npm run start:debug`) and web (`npm run dev:web`).

## Gate baseline (re-measured 2026-11-15 on `chore/repo-cleanup`)

- `npm run typecheck`: passes (root and `apps/web`).
- `npm test`: passes, 23 files, 726 tests.
- `npm run lint`: 0 errors, 29 warnings.
- `npm run i18n:check`: **fails**, 21 of 23 locales each miss 49 keys (`en` has 357); tracked in `k5r.1`.
- CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests, i18n parity, web build and a Linux package smoke test on pull requests. Format check and i18n parity are `continue-on-error` until `00q` and `k5r.1` land.
- `npm audit`: 64 advisories (2 critical, 47 high) as measured before any fix; not re-run, untriaged.

## Recent decisions

- 2026-11-15 — Licence is **MIT** (`LICENSE` replaced on `chore/repo-cleanup`).
- 2026-11-15 — Backlog in **beads**; GitHub Issues stay the public inbox, mirrored by `product-owner`.
- 2026-11-15 — Everything found in review gets fixed in this overhaul, not deferred.
- 2026-11-15 — Web SSRF design: default-deny loopback/private/link-local addresses with `SEEDORA_ALLOW_PRIVATE_HOSTS` opt-in for LAN self-hosting (metadata addresses always denied), optional `SEEDORA_ALLOWED_HOSTS`. Sealed cookie via iron-session, static CSP. See ADRs 0002-0005.
- 2026-11-15 — The committed localhost dev key is removed from the tree and ignored; public history is not rewritten for it.
- 2026-11-15 — Tracked agent and project files are written in English (community-facing).

## Gotchas

- `@shared` resolves to `src/shared` in main/preload builds and to `packages/shared/src` in renderer/web builds; `types.ts` and `key-utils.ts` exist in three identical copies until deduplicated (`mi9`).
- `useMenuEvents` exists twice (`src/renderer/hooks/` and `packages/shared/src/hooks/`); check which one is imported before editing.
- Adding a language touches three places: locale file, `apps/web/src/lib/i18n.ts`, `LANGUAGE_NAMES` in `packages/shared/src/lib/i18n-utils.ts`.
- Filters live in `torrent-store`, not `ui-store`.
- `bd list --json` prints a tree; use `bd list --flat --json --limit 0`. bd owns `core.hooksPath` (`.beads/hooks`) — Husky must chain with it.
- release-please ships a version for any `fix:`/`feat:` reaching `main`; choose commit types deliberately.
- `packages/shared/package.json` points `main`/`types` at a non-existent `src/index.ts`; imports work only through aliases.
- Local-only backup tags `backup/local-staging-2026-11-15` and `backup/local-main-2026-11-15` hold the pre-realignment history. Never push them (they carry a personal author email).
- Electron debugging for agents: `chrome-devtools` MCP on port 9222; web: `chrome-devtools-web`. The main session may start the apps in the background (and stops them after); subagents never do.

- The packaged renderer's origin is `app://seedora`, not `file://`. Renderer-only `localStorage` from older builds resets once. Never trust a `file:` URL in `sender.ts`, never add `corsEnabled`/`bypassCSP` to the scheme.
- A new IPC channel needs: constant in `src/shared/ipc-channels.ts`, zod schema in `security/schemas.ts`, a `handleGuarded` registration, a preload method, a `PlatformApi` entry; renderer-bound events also go in `RENDERER_EVENT_CHANNELS`.

## Pointers

Architecture `docs/architecture.md` · Security model and known gaps `docs/security.md` · Release `docs/release.md` · i18n `docs/i18n.md` · Team and workflow `AGENTS.md`
