import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { missingPluralForms, requiredCategories } from './i18n-plurals.mjs';

describe('requiredCategories', () => {
  it('returns every category for Russian and Arabic', () => {
    expect([...requiredCategories('ru')].sort()).toEqual(['few', 'many', 'one', 'other']);
    expect([...requiredCategories('ar')].sort()).toEqual(['few', 'many', 'one', 'other', 'two', 'zero']);
  });

  it('does not require the large-number `many` of French', () => {
    expect([...requiredCategories('fr')].sort()).toEqual(['one', 'other']);
  });

  it('needs only `other` for Japanese', () => {
    expect(requiredCategories('ja')).toEqual(['other']);
  });
});

describe('missingPluralForms', () => {
  it('flags a Russian family that only has one/other', () => {
    const flat = { 'tray.n_one': 'a', 'tray.n_other': 'b' };
    expect(missingPluralForms(flat, 'ru')).toEqual([{ base: 'tray.n', missing: ['few', 'many'] }]);
  });

  it('accepts a complete family and ignores non-plural keys', () => {
    const flat = { 'tray.n_one': 'a', 'tray.n_other': 'b', 'tray.quit': 'c' };
    expect(missingPluralForms(flat, 'en')).toEqual([]);
  });
});
