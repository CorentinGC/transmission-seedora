import { describe, expect, it } from 'vitest';
import { formatBytes, formatSpeed } from './format';

describe('formatBytes', () => {
  it('formats zero and small values without decimals', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('scales to the right unit', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 ** 3 * 1.5)).toBe('1.50 GB');
  });

  it('returns an empty string for invalid input', () => {
    expect(formatBytes(-1)).toBe('');
    expect(formatBytes(NaN)).toBe('');
  });
});

describe('formatSpeed', () => {
  it('formats rates and clamps non-positive values', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
    expect(formatSpeed(2048)).toBe('2.0 KB/s');
  });
});
