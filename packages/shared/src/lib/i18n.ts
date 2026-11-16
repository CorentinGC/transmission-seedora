import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { localeResources } from '../locales';
import { applyDocumentLanguage } from './document-language';
export { availableLanguages, getLanguageName } from './i18n-utils';

/** Language code (e.g. "fr" from "fr-FR") of the host, when it is one we ship; otherwise English. */
export function detectSystemLanguage(navigatorLanguage: string | undefined): string {
  const code = (navigatorLanguage ?? '').split('-')[0]?.toLowerCase() ?? '';
  return code in localeResources ? code : 'en';
}

i18n.use(initReactI18next).init({
  resources: localeResources,
  lng: detectSystemLanguage(typeof navigator === 'undefined' ? undefined : navigator.language),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

/** Keeps `<html lang dir>` in step with the active language, including the initial one. */
function syncDocumentLanguage(language: string): void {
  applyDocumentLanguage(language, i18n.dir(language));
}

syncDocumentLanguage(i18n.language);
i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
