import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLanguage, onLanguageChange, resolveLanguage, setLanguage, t } from './main-i18n';

const LOCALES = path.resolve(__dirname, '../../../packages/shared/src/locales');

afterEach(() => setLanguage('en'));

describe('main i18n', () => {
  it('resolves region tags and rejects unknown or non-string languages', () => {
    expect(resolveLanguage('fr-CA')).toBe('fr');
    expect(resolveLanguage('PT_br')).toBe('pt');
    expect(resolveLanguage('xx')).toBe('en');
    expect(resolveLanguage('__proto__')).toBe('en');
    expect(resolveLanguage({ toString: () => 'fr' })).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });

  it('translates, interpolates and falls back to the key', () => {
    expect(t('native.menu.file')).toBe('File');
    expect(t('native.menu.quit', { appName: 'Seedora' })).toBe('Quit Seedora');
    setLanguage('fr');
    expect(t('native.menu.file')).not.toBe('File');
    expect(t('native.does.not.exist')).toBe('native.does.not.exist');
    expect(t('constructor')).toBe('constructor');
  });

  it('selects plural forms per language', () => {
    expect(t('native.tray.activeTransfers', { count: 1 })).toBe('1 active transfer');
    expect(t('native.tray.activeTransfers', { count: 3 })).toBe('3 active transfers');
    setLanguage('ru');
    // Depends on the translator adding `_few` / `_many` to ru.json; fails until then.
    expect(t('native.tray.activeTransfers', { count: 2 })).toBe('2 активные передачи');
    expect(t('native.tray.activeTransfers', { count: 5 })).toBe('5 активных передач');
  });

  it('notifies listeners only on a real change', () => {
    const listener = vi.fn();
    const off = onLanguageChange(listener);
    setLanguage('de');
    setLanguage('de-AT');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLanguage()).toBe('de');
    off();
    setLanguage('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('has the native section in every locale file', () => {
    for (const file of fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json'))) {
      const code = file.replace('.json', '');
      setLanguage(code);
      expect(getLanguage()).toBe(code);
      expect(t('native.menu.file'), code).not.toBe('native.menu.file');
      expect(t('native.scriptGuard.title'), code).not.toBe('native.scriptGuard.title');
    }
  });
});
