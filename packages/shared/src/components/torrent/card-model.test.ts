import { describe, expect, it } from 'vitest';
import { COMPACT_LIST_QUERY, menuAnchor, progressWidthPercent } from './card-model';

describe('progressWidthPercent', () => {
  it('converts a ratio to a percentage', () => {
    expect(progressWidthPercent(0.256)).toBeCloseTo(25.6);
  });
  it('clamps out-of-range and non-finite values', () => {
    expect(progressWidthPercent(-1)).toBe(0);
    expect(progressWidthPercent(1.5)).toBe(100);
    expect(progressWidthPercent(Number.NaN)).toBe(0);
  });
});

describe('menuAnchor', () => {
  it('indents under the card', () => {
    expect(menuAnchor({ left: 10, bottom: 50 })).toEqual({ x: 42, y: 50 });
  });
  it('falls back to the origin without a rect', () => {
    expect(menuAnchor(undefined)).toEqual({ x: 32, y: 0 });
  });
});

describe('COMPACT_LIST_QUERY', () => {
  it('targets widths below 640px', () => {
    expect(COMPACT_LIST_QUERY).toBe('(max-width: 639px)');
  });
});
