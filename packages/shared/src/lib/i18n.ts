import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
export { availableLanguages, getLanguageName } from './i18n-utils';

// Auto-discover all locale files via Vite's import.meta.glob (Electron/Vite only)
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

// Detect system language: navigator.language returns e.g. "fr-FR", we extract "fr"
function detectSystemLanguage(): string {
  const raw = navigator.language ?? '';
  const code = raw.split('-')[0].toLowerCase();
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
