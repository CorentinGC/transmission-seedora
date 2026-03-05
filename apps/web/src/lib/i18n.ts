import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Static imports for all locale files (no import.meta.glob in Next.js)
import en from '@shared/locales/en.json';
import fr from '@shared/locales/fr.json';
import de from '@shared/locales/de.json';
import es from '@shared/locales/es.json';
import it from '@shared/locales/it.json';
import pt from '@shared/locales/pt.json';
import nl from '@shared/locales/nl.json';
import pl from '@shared/locales/pl.json';
import cs from '@shared/locales/cs.json';
import ru from '@shared/locales/ru.json';
import uk from '@shared/locales/uk.json';
import tr from '@shared/locales/tr.json';
import ar from '@shared/locales/ar.json';
import ja from '@shared/locales/ja.json';
import ko from '@shared/locales/ko.json';
import zh from '@shared/locales/zh.json';
import da from '@shared/locales/da.json';
import nb from '@shared/locales/nb.json';
import sv from '@shared/locales/sv.json';
import fi from '@shared/locales/fi.json';
import hu from '@shared/locales/hu.json';
import ro from '@shared/locales/ro.json';
import el from '@shared/locales/el.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  de: { translation: de },
  es: { translation: es },
  it: { translation: it },
  pt: { translation: pt },
  nl: { translation: nl },
  pl: { translation: pl },
  cs: { translation: cs },
  ru: { translation: ru },
  uk: { translation: uk },
  tr: { translation: tr },
  ar: { translation: ar },
  ja: { translation: ja },
  ko: { translation: ko },
  zh: { translation: zh },
  da: { translation: da },
  nb: { translation: nb },
  sv: { translation: sv },
  fi: { translation: fi },
  hu: { translation: hu },
  ro: { translation: ro },
  el: { translation: el },
};

// Detect system language
function detectSystemLanguage(): string {
  if (typeof navigator === 'undefined') return 'en';
  const raw = navigator.language ?? '';
  const code = raw.split('-')[0].toLowerCase();
  if (code && code in resources) return code;
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
