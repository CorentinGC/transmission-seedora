---
name: i18n-strings
description: Add or change a user-facing string. Use whenever a label, placeholder, tooltip, message, dialog text, menu or tray label, notification or error shown to the user is added or modified anywhere in the repo (packages/shared, apps/web, src/main).
---

# i18n string management

Every user-visible string goes through i18next. No hardcoded strings in components, in the native menu, in the tray, in notifications, or in errors surfaced to the UI.

## Where things live

- Locale files: `packages/shared/src/locales/<code>.json` — 23 files:
  `en fr de es it pt nl pl cs ru uk tr ar ja ko zh da nb sv fi hu ro el`
- `en.json` is the source of truth.
- Two i18n bootstraps load the same files: `packages/shared/src/lib/i18n.ts` (Electron renderer, `import.meta.glob`) and `apps/web/src/lib/i18n.ts` (web, static imports). Adding a **key** touches only the JSON files. Adding a **language** touches three places: the new locale file, the static imports in `apps/web/src/lib/i18n.ts`, and `LANGUAGE_NAMES` in `packages/shared/src/lib/i18n-utils.ts`.
- Details: `docs/i18n.md`.

## Rules

1. Use `t('section.key')` from `react-i18next` (`useTranslation()`), never a literal.
2. Add the key to **all 23** locale files in the same change.
3. Each file holds a **real translation** in that language — never the English string as a placeholder. Technical tokens that are the same everywhere (`KB/s`, `DHT`, `PEX`, product names) are the only exception.
4. Key naming: dot-separated, namespaced by feature, matching the existing structure (`toolbar.addTorrent`, `statusBar.connected`). Place the key where it fits the existing order of its section, identically in every file.
5. Interpolation uses `{{variable}}`; the same placeholders must appear in every locale. Plurals use i18next suffixes (`_one`, `_other`, plus the forms each language needs).
6. Never look up DOM nodes by translated text (placeholder, label). Use a `ref` or a `data-*` attribute.

## Workflow

1. Pick the section, add the English value to `en.json`.
2. Add the translated value to the 22 other files.
3. Use `t('section.key', { ...values })` in code.
4. Run `npm run i18n:check` — must print `OK`. It fails on missing keys, extra keys and placeholder mismatches. `npm run i18n:check -- --untranslated` lists values still identical to English.
5. Check the rendered string in the running app (see the `verify-ui` skill), including one long-string language (de, fi, ru) and one RTL language (ar) when layout is affected.

For bulk work (many keys × 23 languages), delegate to the `i18n-translator` agent.
