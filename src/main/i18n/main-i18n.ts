/** Main-process i18n: the `native` section of the shared locale files (menu, tray, native dialogs). */

type MessageTree = { [key: string]: string | MessageTree };

const FALLBACK_LANGUAGE = 'en';

// Bundled at build time (no file system access in the packaged app); only the `native` section is kept.
const bundles = import.meta.glob<MessageTree>('../../../packages/shared/src/locales/*.json', {
  eager: true,
  import: 'native',
});

const trees = new Map<string, MessageTree>();
for (const [file, tree] of Object.entries(bundles)) {
  const code = file.split('/').pop()?.replace(/\.json$/, '');
  if (code) trees.set(code, { native: tree });
}

let current = FALLBACK_LANGUAGE;
const listeners = new Set<(language: string) => void>();

/** Maps a stored language preference (renderer-controlled) to a bundled locale code, or the fallback. */
export function resolveLanguage(raw: unknown): string {
  if (typeof raw !== 'string') return FALLBACK_LANGUAGE;
  const primary = raw.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return trees.has(primary) ? primary : FALLBACK_LANGUAGE;
}

/** Current menu/tray language. */
export function getLanguage(): string {
  return current;
}

/** Switches the language and notifies listeners only when it actually changed. */
export function setLanguage(raw: unknown): void {
  const next = resolveLanguage(raw);
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener(next);
}

/** Subscribes to language changes; returns the unsubscribe function. */
export function onLanguageChange(listener: (language: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lookup(tree: MessageTree | undefined, key: string): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || !Object.hasOwn(node, part)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function find(language: string, key: string, count: number | undefined): string | undefined {
  const tree = trees.get(language);
  if (count === undefined) return lookup(tree, key);
  const category = new Intl.PluralRules(language).select(count);
  return lookup(tree, `${key}_${category}`) ?? lookup(tree, `${key}_other`) ?? lookup(tree, key);
}

/** Translates `key` (e.g. `native.menu.file`); `count` selects the plural form. Falls back to English, then the key. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const count = typeof vars.count === 'number' ? vars.count : undefined;
  const template = find(current, key, count) ?? find(FALLBACK_LANGUAGE, key, count) ?? key;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : ''));
}
