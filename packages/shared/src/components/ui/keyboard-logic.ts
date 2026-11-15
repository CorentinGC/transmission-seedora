/**
 * Pure keyboard logic for popups and menus (no DOM), so it can be unit-tested in the node
 * environment. The components translate its results into focus calls.
 */

export type TabWrap = 'first' | 'last' | 'block' | null;

/**
 * Where Tab should go to stay inside a focus trap: `first`/`last` wrap around, `block` means there
 * is nothing focusable, `null` lets the browser move focus normally. `activeIndex` is -1 when focus
 * is on the trap root (or outside the focusable list).
 */
export function tabWrapAction(shiftKey: boolean, activeIndex: number, count: number): TabWrap {
  if (count === 0) return 'block';
  if (shiftKey && activeIndex <= 0) return 'last';
  if (!shiftKey && activeIndex === count - 1) return 'first';
  return null;
}

/** Index a menu key moves to (wrapping), or null when the key does not navigate. */
export function menuNavigationTarget(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  const wrap = (index: number) => (index + count) % count;
  switch (key) {
    case 'ArrowDown':
      return wrap(current + 1);
    case 'ArrowUp':
      return wrap(current === -1 ? count - 1 : current - 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export const TYPEAHEAD_RESET_MS = 700;

export interface TypeaheadState {
  buffer: string;
  at: number;
}

/** True for a printable key that should feed typeahead (not a shortcut, not Space). */
export function isTypeaheadKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ';
}

/**
 * Updates the typeahead buffer in place and returns the index of the next matching label, or -1.
 * A fresh buffer (single character, or the previous one timed out) starts searching after the
 * current item so repeating a letter cycles through items; a growing buffer keeps the current one.
 */
export function typeaheadMatch(
  state: TypeaheadState,
  key: string,
  now: number,
  labels: string[],
  current: number,
): number {
  const char = key.toLowerCase();
  state.buffer = now - state.at > TYPEAHEAD_RESET_MS ? char : state.buffer + char;
  state.at = now;
  if (labels.length === 0) return -1;
  const start = state.buffer.length === 1 ? current + 1 : Math.max(current, 0);
  for (let i = 0; i < labels.length; i++) {
    const index = (start + i) % labels.length;
    if (labels[index].trim().toLowerCase().startsWith(state.buffer)) return index;
  }
  return -1;
}
