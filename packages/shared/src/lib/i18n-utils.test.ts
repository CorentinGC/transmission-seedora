import { describe, expect, it } from 'vitest';
import { resolveLanguageChoice } from './i18n-utils';

describe('resolveLanguageChoice', () => {
  it('shows the active language and switches nothing when the preference is empty', () => {
    expect(resolveLanguageChoice('', 'fr')).toEqual({ selected: 'fr', switchTo: null });
  });
  it('switches only when the chosen language differs from the active one', () => {
    expect(resolveLanguageChoice('de', 'fr')).toEqual({ selected: 'de', switchTo: 'de' });
    expect(resolveLanguageChoice('fr', 'fr')).toEqual({ selected: 'fr', switchTo: null });
  });
});
