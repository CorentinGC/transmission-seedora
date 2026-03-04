import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Auto-discover all locale files in src/renderer/locales/
// To add a new language, create a JSON file named with the ISO 639-1 code (e.g. de.json, es.json, ja.json)
const localeModules = import.meta.glob('../locales/*.json', { eager: true }) as Record<
  string,
  { default?: Record<string, unknown> }
>;

const resources: Record<string, { translation: Record<string, unknown> }> = {};

for (const [path, module] of Object.entries(localeModules)) {
  const match = path.match(/\/(\w+)\.json$/);
  if (match) {
    resources[match[1]] = { translation: (module.default ?? module) as Record<string, unknown> };
  }
}

// Available languages for the preferences UI
export const availableLanguages = Object.keys(resources).sort();

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

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

// Detect system language: navigator.language returns e.g. "fr-FR", we extract "fr"
function detectSystemLanguage(): string {
  const raw = navigator.language ?? '';
  const code = raw.split('-')[0].toLowerCase();
  // Only use it if we have a matching locale file
  if (code && resources[code]) return code;
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectSystemLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
