---
name: update-readme
description: Bring README.md back in line with the code after features, scripts, structure, dependencies or supported languages changed. Use when asked to update the README or after a change that makes it inaccurate.
---

# Update the README

The README is the front door for users and contributors. It must describe what exists, nothing more.

## Steps

1. **What changed** — `git log --oneline -20` and the diff since the README was last touched (`git log -1 --format=%H -- README.md`).
2. **Check the facts against the repo**, not against memory:
   - scripts: root `package.json`, `apps/web/package.json`
   - structure: `src/main`, `src/preload`, `src/renderer`, `src/shared`, `packages/shared/src`, `apps/web`
   - languages: files in `packages/shared/src/locales/`
   - versions: `package.json` files; release state: `CHANGELOG.md`
   - clone URL: `git remote get-url origin`
3. **Update only what is wrong or missing**: Features, Tech stack, Project structure, Getting started (Electron and web), Installation notes, Contributing pointers (`CONTRIBUTING.md`), License.
4. **Leave alone** unless asked: the introduction ("Why this project?"), Acknowledgments, Credits.
5. **Summarise** which sections changed and why. If nothing needs changing, say so and change nothing.

## Rules

- Do not document features that are not in the code.
- Keep the existing tone and format; keep it short. Deep detail belongs in `docs/` — link to it.
- Screenshots live in `docs/screenshots/`; only reference files that exist.
- English only.
