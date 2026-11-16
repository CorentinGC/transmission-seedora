// Human-readable language names (ISO 639-1 code → native name)
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  ru: 'Русский',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  ar: 'العربية',
  pl: 'Polski',
  tr: 'Türkçe',
  sv: 'Svenska',
  da: 'Dansk',
  nb: 'Norsk',
  fi: 'Suomi',
  uk: 'Українська',
  cs: 'Čeština',
  ro: 'Română',
  hu: 'Magyar',
  el: 'Ελληνικά',
};

export const availableLanguages = Object.keys(LANGUAGE_NAMES).sort();

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

/**
 * The language to show in a picker and the one to switch to on save. An empty preference means "follow the system":
 * the picker then shows the active language, and nothing is switched (so saving other settings never changes it).
 */
export function resolveLanguageChoice(
  preference: string,
  active: string,
): { selected: string; switchTo: string | null } {
  if (!preference) return { selected: active, switchTo: null };
  return { selected: preference, switchTo: preference === active ? null : preference };
}
