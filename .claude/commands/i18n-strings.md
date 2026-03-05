## i18n String Management Skill

**Trigger**: Whenever a new user-facing string is added or modified in any React component (`src/renderer/`), it MUST use `useTranslation()` / `t('key')` instead of a hardcoded string.

### Rules

1. **No hardcoded UI strings**: Every user-visible string (labels, placeholders, tooltips, messages, dialog titles/content, button text) MUST use `t('section.key')` from `react-i18next`.

2. **Add keys to ALL locale files**: When adding a new i18n key, you MUST add it to **every** locale file in `src/renderer/locales/`:
   - `en.json` (English) — source of truth
   - `fr.json` (French)
   - `de.json` (German)
   - `es.json` (Spanish)
   - `it.json` (Italian)
   - `pt.json` (Portuguese)
   - `nl.json` (Dutch)
   - `pl.json` (Polish)
   - `cs.json` (Czech)
   - `ru.json` (Russian)
   - `uk.json` (Ukrainian)
   - `tr.json` (Turkish)
   - `ar.json` (Arabic)
   - `ja.json` (Japanese)
   - `ko.json` (Korean)
   - `zh.json` (Chinese)
   - `da.json` (Danish)
   - `nb.json` (Norwegian Bokmål)
   - `sv.json` (Swedish)
   - `fi.json` (Finnish)
   - `hu.json` (Hungarian)
   - `ro.json` (Romanian)
   - `el.json` (Greek)

3. **Translate properly**: Each locale file must contain the **actual translation** in that language, not the English string. Use your language knowledge to provide accurate translations.

4. **Key naming convention**: Use dot-separated namespaced keys matching the existing structure (e.g., `toolbar.addTorrent`, `dialog.confirmDelete`, `statusBar.connected`). Group keys under the relevant section.

5. **Maintain alphabetical order** within each section of the JSON files.

6. **Interpolation**: Use `{{variable}}` syntax for dynamic values (e.g., `"deleteConfirm": "Delete {{count}} torrents?"`). Ensure interpolation placeholders are preserved in all translations.

### Workflow

When adding a new string:
1. Identify the appropriate section/namespace for the key
2. Add the English string to `en.json`
3. Add translations to ALL 22 other locale files
4. Use `t('section.key')` in the component code
5. If the string has interpolation, pass the values: `t('section.key', { count: 5 })`

### Verification

After adding keys, verify:
- The key exists in ALL 23 locale files
- No JSON syntax errors (valid JSON in each file)
- The component renders correctly with the translated string
