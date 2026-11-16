/**
 * Plural-category helpers for the i18n gate (dependency-free, uses Intl.PluralRules).
 */

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/**
 * Plural categories a locale must provide for a key family.
 * `many` is skipped for languages that have no `few` (fr, es, it, pt): there it only covers
 * compact large numbers ("1 million de ...") and i18next falls back to `_other`.
 */
export function requiredCategories(locale) {
  const categories = new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
  if (!categories.has('few')) categories.delete('many');
  return [...categories];
}

/**
 * Finds plural families (keys sharing a base, with at least one plural-suffixed key) whose
 * forms do not cover every category the locale requires.
 * @param {Record<string, unknown>} flat flattened translations
 * @param {string} locale BCP 47 code
 * @returns {{ base: string, missing: string[] }[]}
 */
export function missingPluralForms(flat, locale) {
  const families = new Map();
  for (const key of Object.keys(flat)) {
    const match = PLURAL_SUFFIX.exec(key);
    if (!match) continue;
    const base = key.slice(0, match.index);
    const forms = families.get(base) ?? new Set();
    forms.add(match[1]);
    families.set(base, forms);
  }
  const required = requiredCategories(locale);
  return [...families]
    .map(([base, forms]) => ({ base, missing: required.filter((category) => !forms.has(category)) }))
    .filter((family) => family.missing.length > 0);
}
