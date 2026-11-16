## What and why

<!-- What does this change, and why? Link the issue: Closes #123 -->

## Checks

Target branch is `staging`. Commit messages follow Conventional Commits (the type decides whether a release ships).

- [ ] `npm run typecheck` passes
- [ ] `npm run lint`: no new failures
- [ ] `npm run i18n:check`: no new failures
- [ ] `npm run build:web` passes (if the web app or shared UI changed)
- [ ] New logic has a test (once the test runner is available)
- [ ] UI changes checked in light and dark themes, in the Electron and web apps where the UI is shared
- [ ] New or changed user-facing strings are in all 23 locale files with real translations
- [ ] No credentials or private data in code, logs or screenshots
- [ ] Changes to IPC, server actions, file paths, URLs or credentials follow the security rules in `CONTRIBUTING.md`

## Notes for the reviewer

<!-- Anything unverified, trade-offs, follow-up work. -->
