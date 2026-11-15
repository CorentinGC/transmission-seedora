# MEMORY — Seedora

> Working memory. READ before coding, UPDATE when a task changes the state. Keep it under 150 lines. Stable documentation lives in `docs/` (index: `llms.txt`); the backlog lives in beads (`bd ready`).

## Current state (2026-11-15)

- Project resumed after an 8-month pause (last release 1.2.1, 2026-03-05). Overhaul in three phases: (1) agentic setup, (2) repo cleanup and community readiness, (3) full review with fixes.
- **Phase 1 done on branch `chore/agentic-setup`** (not pushed): `CLAUDE.md`, `AGENTS.md`, nested `CLAUDE.md`, `docs/`, `llms.txt`, 12 agents in `.claude/agents/`, 3 skills in `.claude/skills/`, tracked `.claude/settings.json` + post-edit hook, `scripts/i18n-check.mjs`, beads backlog (100 issues, 9 epics; exported to `.beads/issues.jsonl`).
- Phases 2 and 3 not started. Their work is entirely in beads.

## Next steps

- [ ] Phase 2 — repo cleanup: epic `seedora-transmission-mi9` and tests/CI epic `seedora-transmission-we5` (Vitest foundation `we5.1` unblocks several fixes — do it first).
- [ ] Phase 3 — P0 security first: web epic `seedora-transmission-c07`, Electron epic `seedora-transmission-23u`; then bugs `0cl`, i18n `k5r`, a11y/design `vpz`.
- [ ] Phase 4 (after 2–3) — epic `seedora-transmission-52c`: landing page on `seedora.app`, web app moved to `app.seedora.app`, landing SEO, Google Search Console registration (via the browser, with the user's confirmation). Hosting and DNS are not defined in the repo — ask the user first.
- [ ] Do not push `chore/agentic-setup` before the P0 web fixes are ready to ship: `docs/security.md` describes gaps that are live on seedora.app.
- [ ] Visual review pass (`vpz.10`) needs the user to start Electron (`npm run start:debug`) and web (`npm run dev:web`).

## Baseline measured on 2026-11-15 (origin/staging, before any fix)

- `npm run typecheck`: passes (root and `apps/web`).
- `npm run lint`: **fails** — mostly `import/no-unresolved` because the legacy `.eslintrc.json` does not resolve workspace aliases; migration to flat config is tracked (`mi9.10`).
- `npm run i18n:check`: **fails** — 21 locales each miss 49 keys (`en` and `fr` have 356).
- Tests: none exist. No CI on pull requests.
- `npm audit`: 64 advisories (2 critical, 47 high) — untriaged; most likely in the build toolchain, to confirm.

## Recent decisions

- 2026-11-15 — Licence is **MIT** (the `LICENSE` file still holds the old non-commercial text until Phase 2 replaces it).
- 2026-11-15 — Backlog in **beads**; GitHub Issues stay the public inbox, mirrored by `product-owner`.
- 2026-11-15 — Everything found in review gets fixed in this overhaul, not deferred.
- 2026-11-15 — Web SSRF design: default-deny loopback/private/link-local/metadata addresses, `SEEDORA_ALLOW_PRIVATE_HOSTS` opt-in for LAN self-hosting.
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
- Electron debugging for agents: `chrome-devtools` MCP on port 9222; web: `chrome-devtools-web`. Agents never start the apps.

## Pointers

Architecture `docs/architecture.md` · Security model and known gaps `docs/security.md` · Release `docs/release.md` · i18n `docs/i18n.md` · Team and workflow `AGENTS.md`
