import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { localeResources } from '../locales';
import { availableLanguages } from './i18n-utils';
import { detectSystemLanguage } from './i18n';

describe('locale registry', () => {
  it('registers every locale file and every language name', () => {
    const files = readdirSync(path.join(__dirname, '../locales'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
      .sort();
    expect(Object.keys(localeResources).sort()).toEqual(files);
    expect(availableLanguages).toEqual(files);
  });
});

describe('detectSystemLanguage', () => {
  it('maps a regional tag to a shipped language and falls back to English', () => {
    expect(detectSystemLanguage('fr-FR')).toBe('fr');
    expect(detectSystemLanguage('xx-YY')).toBe('en');
    expect(detectSystemLanguage(undefined)).toBe('en');
  });
});
