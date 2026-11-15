import { describe, expect, it } from 'vitest';
import { keysToCarmel, keysToKebab } from '@shared/key-utils';

describe('key-utils (main/preload copy)', () => {
  it('converts kebab-case keys to camelCase recursively', () => {
    expect(keysToCarmel({ 'speed-limit-down': 5, nested: { 'a-b': [{ 'c-d': 1 }] } })).toEqual({
      speedLimitDown: 5,
      nested: { aB: [{ cD: 1 }] },
    });
  });

  it('converts camelCase to kebab-case but keeps the legacy camelCase exceptions', () => {
    expect(keysToKebab({ speedLimitDown: 5, seedRatioLimit: 2, seedRatioLimited: true })).toEqual({
      'speed-limit-down': 5,
      seedRatioLimit: 2,
      seedRatioLimited: true,
    });
  });
});
