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

`.github/workflows/ci.yml` runs on every pull request and on push to `staging`, on GitHub-hosted runners (`runs-on: ubuntu-latest`, Node 24; owner decision 2026-11-16, the self-hosted `helmut` runners are bound to other repositories): lint, format check, typecheck, unit tests, `i18n:check`, `npm run build:web`, `npm run package` (Linux smoke) and `commitlint` (PR title, plus the commits a PR into `staging` adds). Permissions are `contents: read`; no PR job needs a write token. Fork pull requests run too, with a read-only token and no secrets. Every job is blocking, including the format check (`npm run format:check`). `release-please.yml` keeps its GitHub-hosted build matrix (macOS and Windows runners are needed), with per-job permissions and third-party actions pinned to a commit SHA. `codeql.yml` runs CodeQL on GitHub-hosted runners; `dependabot.yml` opens weekly grouped dependency PRs against `staging` (Electron majors are ignored: they go through `mi9.18`). Dependency audit status: [dependency-audit.md](dependency-audit.md).

### Which commit types reach the changelog

`release-please-config.json` lists the sections. Only `feat`, `fix` and `perf` are visible, and release-please drops hidden types from both the changelog and the release trigger: a `build:` or `revert:` commit never opens a release PR, and never appears in a changelog. Showing one of them is a release-policy decision (it would make each such commit ship a patch version), decided in `ec9` (2026-11-16): keep them hidden, so a dependency bump, build change or revert never ships a release on its own; a user-visible revert or dependency fix is written as `fix:` / `fix(deps):`. Scopes do not create sections: `fix(security):` lands under Bug Fixes. `commitlint` allows `feat fix perf refactor docs test build ci chore style revert` locally (pre-commit hook) and in CI (PR title and commits).

### Repository settings (owner actions)

The runners are GitHub-hosted, so fork PR code never touches your hardware. These settings cannot be set from the repository:

1. Settings > Actions > General > Fork pull request workflows: choose "Require approval for all external contributors" (currently `first_time_contributors`). CLI: `gh api -X PUT repos/CorentinGC/transmission-seedora/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors`.
2. Settings > Actions > General > Workflow permissions: "Read repository contents" as the default, and leave "Allow GitHub Actions to create and approve pull requests" on only if release-please needs it (it does, to open the release PR).
3. Branch protection on `staging` and `main`: block force-push and deletion. Required status checks and required reviews are deliberately off: the release-please PR and the `sync-staging` bot push cannot satisfy them, and the owner is the only maintainer. CI is still run on every PR and a red gate is fixed before merging.
4. Settings > Code security: turn CodeQL "default setup" off (the repo ships `codeql.yml`), and turn on Dependabot alerts and security updates.

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
