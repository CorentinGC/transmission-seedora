/**
 * The single locale registry shared by every host (Electron renderer, Next.js web app).
 * Static imports work in both Vite and Next.js, so no host needs its own loader.
 * Adding a language: add its JSON file, one line here and its name in `lib/i18n-utils.ts`
 * (`lib/i18n.test.ts` fails when they drift apart).
 */
import en from './en.json';
import fr from './fr.json';
import de from './de.json';
import es from './es.json';
import it from './it.json';
import pt from './pt.json';
import nl from './nl.json';
import pl from './pl.json';
import cs from './cs.json';
import ru from './ru.json';
import uk from './uk.json';
import tr from './tr.json';
import ar from './ar.json';
import ja from './ja.json';
import ko from './ko.json';
import zh from './zh.json';
import da from './da.json';
import nb from './nb.json';
import sv from './sv.json';
import fi from './fi.json';
import hu from './hu.json';
import ro from './ro.json';
import el from './el.json';

export const localeResources = {
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
