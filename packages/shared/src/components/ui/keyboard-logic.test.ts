import { describe, expect, it } from 'vitest';
import {
  isTypeaheadKey,
  menuNavigationTarget,
  tabWrapAction,
  typeaheadMatch,
  TYPEAHEAD_RESET_MS,
  type TypeaheadState,
} from './keyboard-logic';

describe('tabWrapAction', () => {
  it('blocks Tab when nothing is focusable', () => {
    expect(tabWrapAction(false, -1, 0)).toBe('block');
  });
  it('wraps forward from the last element', () => {
    expect(tabWrapAction(false, 2, 3)).toBe('first');
    expect(tabWrapAction(false, 1, 3)).toBeNull();
  });
  it('wraps backward from the first element or the root', () => {
    expect(tabWrapAction(true, 0, 3)).toBe('last');
    expect(tabWrapAction(true, -1, 3)).toBe('last');
    expect(tabWrapAction(true, 1, 3)).toBeNull();
  });
  it('keeps a single element trapped in both directions', () => {
    expect(tabWrapAction(false, 0, 1)).toBe('first');
    expect(tabWrapAction(true, 0, 1)).toBe('last');
  });
});

describe('menuNavigationTarget', () => {
  it('wraps ArrowDown and ArrowUp', () => {
    expect(menuNavigationTarget('ArrowDown', 2, 3)).toBe(0);
    expect(menuNavigationTarget('ArrowUp', 0, 3)).toBe(2);
  });
  it('starts from the ends when no item is focused', () => {
    expect(menuNavigationTarget('ArrowDown', -1, 3)).toBe(0);
    expect(menuNavigationTarget('ArrowUp', -1, 3)).toBe(2);
  });
  it('jumps with Home and End', () => {
    expect(menuNavigationTarget('Home', 2, 4)).toBe(0);
    expect(menuNavigationTarget('End', 0, 4)).toBe(3);
  });
  it('returns null for other keys or an empty menu', () => {
    expect(menuNavigationTarget('a', 0, 3)).toBeNull();
    expect(menuNavigationTarget('ArrowDown', -1, 0)).toBeNull();
  });
});

describe('typeaheadMatch', () => {
  const labels = ['Pause', 'Start now', 'Start', 'Verify'];
  const fresh = (): TypeaheadState => ({ buffer: '', at: 0 });

  it('finds the first label starting with the typed letter, after the current item', () => {
    expect(typeaheadMatch(fresh(), 's', 1000, labels, 0)).toBe(1);
  });
  it('cycles through items sharing a first letter when the letter repeats', () => {
    const state = fresh();
    expect(typeaheadMatch(state, 's', 1000, labels, 0)).toBe(1);
    // A repeated key within the window grows the buffer ("ss") and no longer matches; after the
    // window it restarts and moves to the next item.
    expect(typeaheadMatch(state, 's', 1000 + TYPEAHEAD_RESET_MS + 1, labels, 1)).toBe(2);
  });
  it('narrows with a growing buffer without leaving the current item', () => {
    const state = fresh();
    expect(typeaheadMatch(state, 's', 1000, labels, 0)).toBe(1);
    expect(typeaheadMatch(state, 't', 1100, labels, 1)).toBe(1);
    expect(typeaheadMatch(state, 'a', 1200, labels, 1)).toBe(1);
    expect(typeaheadMatch(state, 'r', 1300, labels, 1)).toBe(1);
    expect(typeaheadMatch(state, 't', 1400, labels, 1)).toBe(1);
    expect(state.buffer).toBe('start');
  });
  it('is case-insensitive, ignores leading whitespace and returns -1 without a match', () => {
    expect(typeaheadMatch(fresh(), 'V', 1000, ['  verify'], -1)).toBe(0);
    expect(typeaheadMatch(fresh(), 'z', 1000, labels, 0)).toBe(-1);
    expect(typeaheadMatch(fresh(), 'z', 1000, [], 0)).toBe(-1);
  });
});

describe('isTypeaheadKey', () => {
  const base = { ctrlKey: false, metaKey: false, altKey: false };
  it('accepts printable characters only', () => {
    expect(isTypeaheadKey({ key: 'a', ...base })).toBe(true);
    expect(isTypeaheadKey({ key: ' ', ...base })).toBe(false);
    expect(isTypeaheadKey({ key: 'Enter', ...base })).toBe(false);
    expect(isTypeaheadKey({ key: 'a', ...base, ctrlKey: true })).toBe(false);
  });
});
