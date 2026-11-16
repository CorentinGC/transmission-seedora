import { describe, expect, it } from 'vitest';
import { applyDocumentLanguage } from './document-language';

describe('applyDocumentLanguage', () => {
  it('sets lang and dir on the target', () => {
    const target = { lang: 'en', dir: 'ltr' };
    applyDocumentLanguage('ar', 'rtl', target);
    expect(target).toEqual({ lang: 'ar', dir: 'rtl' });
    applyDocumentLanguage('fr', 'ltr', target);
    expect(target).toEqual({ lang: 'fr', dir: 'ltr' });
  });

  it('does nothing when there is no document', () => {
    expect(() => applyDocumentLanguage('fr', 'ltr')).not.toThrow();
  });
});
