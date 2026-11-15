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
- Changelog sections: Features (`feat`), Bug Fixes (`fix`), Performance (`perf`). `refactor`, `chore`, `docs`, `style`, `test`, `ci` are recorded but hidden and do not trigger a release on their own.
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

`.github/workflows/ci.yml` runs on every pull request and on push to `staging`, on the self-hosted Linux runner `helmut` (`runs-on: [self-hosted, helmut]`, Node 22): lint, format check, typecheck, unit tests, `i18n:check`, `npm run build:web` and `npm run package` (Linux smoke). Jobs are skipped for pull requests from forks, because the repository is public and the runner is self-hosted. A job that is red on the baseline carries `continue-on-error` and a comment naming the beads issue that removes it. `release-please.yml` keeps its GitHub-hosted build matrix. `codeql.yml` runs CodeQL on `helmut`; `dependabot.yml` opens weekly grouped dependency PRs against `staging`.

Local hooks (`.beads/hooks`, chaining `scripts/git-hooks/`): `pre-commit` runs lint-staged, `commit-msg` runs commitlint (Conventional Commits).

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
