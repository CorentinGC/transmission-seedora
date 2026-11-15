# Contributing to Seedora

Thank you for helping. This page covers how to set up, what a pull request must satisfy, and how the project is organised. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Seedora is released under the [MIT licence](LICENSE); your contributions are licensed the same way.

## Ways to contribute

- **Report a bug or suggest a feature**: open a [GitHub issue](https://github.com/CorentinGC/transmission-seedora/issues/new/choose) and pick a template.
- **Fix or translate**: pick an issue or open one first for anything larger than a small fix.
- **Report a vulnerability**: do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Set up

You need Node.js 22.12 or later, npm 10 or later, and a Transmission daemon with RPC enabled.

```bash
git clone https://github.com/CorentinGC/transmission-seedora.git
cd transmission-seedora
npm ci
npm start          # Electron app in development mode
npm run dev:web    # web app on http://localhost:3000
```

Use npm only; the lockfile is at the repository root. More detail: [docs/setup.md](docs/setup.md). How the code is organised: [docs/architecture.md](docs/architecture.md). Coding rules: [docs/conventions.md](docs/conventions.md).

## Branches and pull requests

- `main` is the default branch and is released; `staging` is the integration branch. Never commit directly to either.
- Create your branch from `staging` and open your pull request **into `staging`**. Maintainers decide when `staging` is merged into `main`.
- One logical change per pull request. Explain what changed and why; link the issue.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `ci:`, `build:`, `chore:`, `style:`.

The type matters. [release-please](https://github.com/googleapis/release-please) reads commits on `main` and publishes a release for every `feat:`, `fix:` or `perf:` that reaches it (`fix` gives a patch version, `feat` a minor one, a breaking change a major one). Use `docs:`, `test:`, `ci:`, `refactor:`, `build:` or `chore:` for work that should not ship a version. Do not edit `CHANGELOG.md` or version fields by hand. Details: [docs/release.md](docs/release.md).

## Checks before you open a pull request

```bash
npm run typecheck    # TypeScript, root and web app
npm run lint         # ESLint
npm run i18n:check   # every locale has the same keys as en.json
npm run format:check # Prettier (npm run format fixes)
npm test             # Vitest unit tests
npm run build:web    # web app production build
```

All of these gates are green on the baseline and CI runs them on every pull request, so none may fail. New logic should come with a test, and a bug fix should start with a failing test.

If you change the UI, check it in the running app in both light and dark themes, and for shared UI in both the Electron and web apps.

## Translations

Every user-facing string uses `t('section.key')`. A new or changed key goes into **all 23** files in `packages/shared/src/locales/` with a real translation in that language, never the English text. Keep `{{variable}}` placeholders unchanged and keep names such as Seedora and Transmission untranslated. Run `npm run i18n:check`.

Adding a language touches three places: the locale file, `apps/web/src/lib/i18n.ts`, and `LANGUAGE_NAMES` in `packages/shared/src/lib/i18n-utils.ts`. Full rules: [docs/i18n.md](docs/i18n.md). You can also open a "Translation" issue to report a wrong or missing translation.

## Security rules for code

- The Electron renderer and every caller of a Next.js server action are untrusted. Validate every argument on the trusted side (main process, server).
- No renderer-supplied file path may reach the file system unless it came from a dialog opened by the main process.
- Credentials are never logged and never stored or sent unencrypted by new code.
- Do not weaken `BrowserWindow` options, the CSP, security headers or Electron fuses.

Model and known gaps: [docs/security.md](docs/security.md).

## Design source files

The logo source (`seedora_logo.psd`) lives in `resources/design/`. Shipped icons stay in `resources/`; regenerate them with `npm run generate:icons`. `resources/design/` is not part of the packaged app.

## Code style in short

TypeScript strict, no `any`, no `@ts-ignore`; reuse existing helpers and the primitives in `packages/shared/src/components/ui`; theme colour tokens instead of raw Tailwind palette classes; keyboard-operable elements with accessible names; `packages/shared` imports nothing from Electron, Node or Next.js; code, comments and commit messages in English.

## AI agents and the issue tracker

The maintainers work with AI coding agents, and you are welcome to as well. Rules for agents are in [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md); a documentation index for agents is [llms.txt](llms.txt). Whatever tool you use, you are responsible for what you submit, and a human must have reviewed it.

Maintainers track work in [beads](https://github.com/steveyegge/beads) (`.beads/issues.jsonl`). You do not need it to contribute: GitHub Issues are the public inbox, and maintainers mirror accepted issues into beads.
