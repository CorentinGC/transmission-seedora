# AGENTS.md — Seedora

Rules for AI coding agents working on this repository (Claude Code and any other tool that reads `AGENTS.md`). Project facts and conventions are in `CLAUDE.md`; documentation is indexed in `llms.txt`.

## The team

The project is maintained by a team of specialised agents, defined in `.claude/agents/`. The main session orchestrates: it delegates to the agent that owns the area, and integrates the results.

| Agent | Owns | Writes to |
|-------|------|-----------|
| `product-owner` | backlog, priorities, acceptance criteria, triage of community issues | beads only |
| `tech-lead` | architecture, cross-area plans, ADRs | `docs/**` |
| `dev-electron` | main process, preload, IPC, packaging | `src/main`, `src/preload`, `src/shared`, `src/renderer/electron-api.ts`, forge/vite configs |
| `dev-frontend` | shared UI, stores, hooks, client logic | `packages/shared/src`, `src/renderer` |
| `dev-web` | Next.js app, server actions, session, PWA | `apps/web` |
| `ux-designer` | design system, accessibility, responsive | UI primitives, tokens, component markup/styles |
| `i18n-translator` | the 23 locales, string extraction | `packages/shared/src/locales`, string call sites |
| `qa-engineer` | unit and e2e tests, verification against acceptance criteria | test files and test config |
| `code-reviewer` | independent review of every diff | nothing (read-only) |
| `security-auditor` | security review of sensitive changes and releases | nothing (read-only) |
| `release-manager` | CI, release-please, packaging, dependency updates | `.github/**`, release and tooling config |
| `tech-writer` | README, contributor docs, `docs/**`, `llms.txt`, `MEMORY.md` | documentation files |

### Workflow for a piece of work

1. **Specify** — `product-owner` makes sure a beads issue exists with acceptance criteria.
2. **Design** (only when the change spans areas, touches `PlatformApi`, IPC, storage or adds a dependency) — `tech-lead` produces the plan and the task split.
3. **Build** — the owning developer agent(s) implement, test-first for logic. Independent tasks run in parallel, one agent per area; an agent stays inside the paths it owns.
4. **Review** — `code-reviewer` on the diff, plus `security-auditor` when IPC, server actions, credentials, file paths, URLs, parsing, dependencies or CI are touched. Findings go back to the developer agent; repeat until approved.
5. **Verify** — `qa-engineer` checks each acceptance criterion; UI changes are verified in the running app (`verify-ui` skill).
6. **Document** — `tech-writer` updates what the change made inaccurate; `MEMORY.md` reflects the new state.
7. **Hand over** — close the beads issue, report to the user, and wait for their go-ahead before any commit is pushed or PR opened.

Small, single-area fixes may skip step 2. Steps 4 and 5 are never skipped.

### Rules for every agent

- Read before writing: the code you change, its callers, the nested `CLAUDE.md`, the relevant `docs/` page. Verify facts in the repo; do not rely on memory of a library — check its current docs (context7 MCP or the package's own docs) for the version in `package.json`.
- Stay in your lane. If the task needs a change outside the paths you own, report it instead of making it.
- Prefer what exists (helpers, primitives, store actions, official tooling) over new code or a new dependency.
- Report honestly: real gate output, what was verified and how, what was not. "Unverified" is an acceptable status; a false "done" is not.
- Never start the Electron app or the web server; the user does.
- Never commit, push, open a PR, tag, publish or change repository settings unless the user has explicitly asked for that action.
- Secrets and credentials never go into logs, messages, commits or issue text.

## Non-interactive shell commands

Use non-interactive flags so a command never waits for confirmation: `cp -f`, `mv -f`, `rm -f`, `rm -rf`, `cp -rf`; `ssh`/`scp -o BatchMode=yes`; `apt-get -y`; `HOMEBREW_NO_AUTO_UPDATE=1 brew ...`.

<!-- BEGIN BEADS INTEGRATION -->
## Issue tracking with bd (beads)

This project uses **bd (beads)** for all task tracking. Do not create markdown TODO lists or any second tracking system. GitHub Issues are the public inbox for the community; `product-owner` mirrors accepted ones into beads.

```bash
bd ready --json                          # unblocked work, start here
bd list --flat --json --limit 0          # everything, as JSON (plain `bd list --json` prints a tree)
bd show <id>                             # details and acceptance criteria
bd update <id> --claim --json            # claim before working
bd create "Title" --description="What, where, acceptance criteria" -t bug|feature|task|chore|epic -p 0-4 --json
bd create "Found while working" -p 1 --deps discovered-from:<parent-id> --json
bd dep add <blocked-id> <blocker-id>     # real blocking dependency
bd close <id> --reason "Done" --json
```

Types: `bug` (broken), `feature` (new), `task` (tests, docs, refactoring), `chore` (dependencies, tooling), `epic` (grouping).

Priorities: `0` critical (security, data loss, broken build) · `1` high · `2` medium (default) · `3` low (polish) · `4` backlog.

Rules:

- Check `bd ready` before asking what to work on; claim an issue before starting it.
- File newly discovered work as its own issue linked with `discovered-from`; do not silently widen the current task.
- Close an issue only when its acceptance criteria are met and verified.
- bd installs git hooks through `core.hooksPath` (`.beads/hooks`) and keeps `.beads/` in sync with git on commit; other hook tooling must chain with it.
<!-- END BEADS INTEGRATION -->

## Ending a work session

1. File beads issues for anything left to do; close what is finished and verified.
2. Run the gates for what changed (`npm run typecheck`, `npm run lint`, `npm test`, `npm run i18n:check`, `npm run build:web`) and note the results.
3. Update `MEMORY.md` (state, next steps, gotchas).
4. Leave the work committed locally on its branch **only if the user asked for commits**; otherwise leave it in the working tree and say so.
5. Report to the user: what changed, gate results, what is unverified, and the exact push/PR commands they can approve. **Do not push** — pushing and opening PRs happen only on the user's explicit request.
