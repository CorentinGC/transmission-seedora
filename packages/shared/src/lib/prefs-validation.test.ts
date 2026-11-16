import { describe, expect, it } from 'vitest';
import { hasValidNumbers, parseNumberInput } from './prefs-validation';

describe('hasValidNumbers', () => {
  it('accepts a sane interval and presets', () => {
    expect(hasValidNumbers({ pollingInterval: 3000, speedPresets: [0, 100] })).toBe(true);
    expect(hasValidNumbers({ pollingInterval: 250 })).toBe(true);
  });
  it('rejects NaN or too small intervals', () => {
    expect(hasValidNumbers({ pollingInterval: Number.NaN })).toBe(false);
    expect(hasValidNumbers({ pollingInterval: 249 })).toBe(false);
  });
  it('rejects NaN or negative presets', () => {
    expect(hasValidNumbers({ pollingInterval: 3000, speedPresets: [Number.NaN] })).toBe(false);
    expect(hasValidNumbers({ pollingInterval: 3000, speedPresets: [-1] })).toBe(false);
  });
});

describe('parseNumberInput', () => {
  it('maps empty input to NaN instead of 0', () => {
    expect(parseNumberInput('')).toBeNaN();
    expect(parseNumberInput('  ')).toBeNaN();
    expect(parseNumberInput('500')).toBe(500);
    expect(parseNumberInput('abc')).toBeNaN();
  });
});
