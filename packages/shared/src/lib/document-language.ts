/** The two attributes of the document element that describe its language and text direction. */
export interface LanguageTarget {
  lang: string;
  dir: string;
}

/**
 * Reflects the active UI language on the document element (`lang`, `dir`) so screen readers pick
 * the right voice and right-to-left locales mirror. A no-op outside a document (SSR, tests).
 */
export function applyDocumentLanguage(
  language: string,
  direction: 'ltr' | 'rtl',
  target: LanguageTarget | undefined = typeof document === 'undefined' ? undefined : document.documentElement,
): void {
  if (!target) return;
  target.lang = language;
  target.dir = direction;
}
