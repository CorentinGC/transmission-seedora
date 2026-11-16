import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from './i18n/main-i18n';
import { formatSpeed } from './format-speed';

afterEach(() => setLanguage('en'));

describe('formatSpeed', () => {
  it('scales B/s, KB/s and MB/s from the native.tray.units strings', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
    expect(formatSpeed(1023)).toBe('1023 B/s');
    expect(formatSpeed(1536)).toBe('1.5 KB/s');
    expect(formatSpeed(5 * 1024 * 1024)).toBe('5.0 MB/s');
  });

  it('reads the unit templates through t() so the language applies', () => {
    setLanguage('en');
    const english = formatSpeed(2048);
    expect(english).toBe('2.0 KB/s');
    setLanguage('fr');
    expect(formatSpeed(2048)).toContain('2.0');
  });
});
