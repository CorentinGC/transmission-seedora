# Release process

## Branch flow

```
feature branch ──PR──▶ staging ──PR──▶ main ──▶ release PR ──merge──▶ tag + GitHub Release
                          ▲                                               │
                          └────────────── sync-staging (auto) ◀───────────┘
```

- Work lands in `staging` through PRs.
- A PR from `staging` to `main` is the decision to ship.
- `main` is the default branch. Nothing is committed to it directly.

## release-please

Releases are automated by [release-please](https://github.com/googleapis/release-please) (`release-please-config.json`, `.release-please-manifest.json`), `release-type: node`, single root package.

- It reads **Conventional Commits** on `main`. Any `feat:`, `fix:` or `perf:` commit reaching `main` opens or updates a release PR (`chore(main): release seedora X.Y.Z`).
- Merging that PR bumps `package.json`, updates `CHANGELOG.md`, creates the tag and the GitHub Release.
- Changelog sections: Features (`feat`), Bug Fixes (`fix`), Performance (`perf`). `refactor`, `chore`, `docs`, `style`, `test`, `ci` are hidden and do not trigger a release on their own (see "Which commit types reach the changelog" below).
- Version bump: `fix` → patch, `feat` → minor, breaking change (`!` or `BREAKING CHANGE:`) → major.
- Tags: `seedora-vX.Y.Z`.
- Only the root package is versioned. `@seedora/web` and `@seedora/shared` stay at their own static version.

Consequence: commit types are release decisions. A `fix:` that is really a refactor ships a patch release; a real fix typed `chore:` is missing from the changelog.

## Workflow

`.github/workflows/release-please.yml`, triggered on push to `main`:

| Job | Runs when | Does |
|---|---|---|
| `release-please` | always | Opens / updates the release PR, or creates the release when that PR is merged |
| `build` | a release was created | Matrix macOS / Ubuntu / Windows on Node 22: `npm ci`, `npm run make`, uploads `.dmg`, `.zip`, `.exe`, `.nupkg`, `.deb`, `.rpm` to the GitHub Release |
| `sync-staging` | a release was created | Merges `main` back into `staging` and pushes |

## CI

`.github/workflows/ci.yml` runs on every pull request and on push to `staging`, on the self-hosted Linux runner `helmut` (`runs-on: [self-hosted, helmut]`, Node 22): lint, format check, typecheck, unit tests, `i18n:check`, `npm run build:web`, `npm run package` (Linux smoke) and `commitlint` (PR title, plus the commits a PR into `staging` adds). Permissions are `contents: read`; no PR job needs a write token. Jobs are skipped for pull requests from forks, because the repository is public and the runner is self-hosted. The only `continue-on-error` job is the format check, red until the repo-wide Prettier commit (`00q`) lands; the flag goes with it. `release-please.yml` keeps its GitHub-hosted build matrix (macOS and Windows runners are needed), with per-job permissions and third-party actions pinned to a commit SHA. `codeql.yml` runs CodeQL on `helmut`; `dependabot.yml` opens weekly grouped dependency PRs against `staging` (Electron majors are ignored: they go through `mi9.18`). Dependency audit status: [dependency-audit.md](dependency-audit.md).

### Which commit types reach the changelog

`release-please-config.json` lists the sections. Only `feat`, `fix` and `perf` are visible, and release-please drops hidden types from both the changelog and the release trigger: a `build:` or `revert:` commit never opens a release PR, and never appears in a changelog. Showing one of them is a release-policy decision (it would make each such commit ship a patch version), tracked in `ec9`. Scopes do not create sections: `fix(security):` lands under Bug Fixes. `commitlint` allows `feat fix perf refactor docs test build ci chore style revert` locally (pre-commit hook) and in CI (PR title and commits).

### Self-hosted runner on a public repository (owner actions)

Fork PR code must never run on `helmut`. The workflows skip fork PRs (`head.repo.full_name == github.repository`), but that is the second line of defence. The owner has to confirm the first, which cannot be set from the repository:

1. Settings > Actions > General > Fork pull request workflows: choose "Require approval for all external contributors" (currently `first_time_contributors`). CLI: `gh api -X PUT repos/CorentinGC/transmission-seedora/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors`.
2. Settings > Actions > Runners: confirm `helmut` is attached to this repository only (not an organisation-wide group), labelled `helmut`.
3. Run the runner as an ephemeral or containerised job runner, as an unprivileged user, with no repository or deployment secrets on the host, and no route from it to the LAN. A job runs arbitrary repository code (`npm ci` lifecycle scripts included) even for same-repo PRs.
4. Settings > Actions > General > Workflow permissions: "Read repository contents" as the default, and leave "Allow GitHub Actions to create and approve pull requests" on only if release-please needs it (it does, to open the release PR).
5. Branch protection (or a ruleset) on `staging` and `main`: require the CI checks listed above and one review; this is also what makes "red gate is fixed" enforceable.
6. Settings > Code security: turn CodeQL "default setup" off (the repo ships `codeql.yml`), and turn on Dependabot alerts and security updates.

Local hooks (`.beads/hooks`, chaining `scripts/git-hooks/`): `pre-commit` runs lint-staged, `commit-msg` runs commitlint (Conventional Commits).

### Community settings (owner actions)

`SECURITY.md` points at GitHub private vulnerability reporting and `translation.yml` uses a `translation` label; neither exists yet (checked read-only on 2026-11-15: reporting disabled, no such label).

- Private reporting: Settings > Code security > Private vulnerability reporting > Enable. CLI: `gh api -X PUT repos/CorentinGC/transmission-seedora/private-vulnerability-reporting`.
- Label: `gh label create translation --color 0e8a16 --description "Translation or localisation issue" -R CorentinGC/transmission-seedora`.

## What a release contains

- Electron installers built by Electron Forge (`forge.config.ts`): DMG + ZIP (macOS), Squirrel `Seedora-Setup.exe` (Windows), deb + rpm (Linux).
- **Builds are unsigned and not notarized.** Users see Gatekeeper / SmartScreen warnings; the README documents the workarounds.
- **There is no auto-update.** Users download new versions from GitHub Releases.
- The web app is not built or deployed by this workflow.

## Checklist before merging `staging` into `main`

1. Lint, type-check, tests and `npm run build:web` pass on `staging`.
2. `npm run make` succeeds locally on at least one platform.
3. Commit types on `staging` reflect what should appear in the changelog.
4. After the release PR is merged, check that the three build jobs uploaded their artifacts and that `staging` was synced.
