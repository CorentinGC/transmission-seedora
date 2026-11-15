import { describe, expect, it } from 'vitest';
import { gridKeyAction, type GridKeyEvent } from './grid-keys';

const key = (k: string, mods: Partial<GridKeyEvent> = {}): GridKeyEvent => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
});

describe('gridKeyAction', () => {
  it('ignores everything on an empty grid', () => {
    expect(gridKeyAction(key('ArrowDown'), -1, 0)).toBeNull();
  });

  it('moves and selects with plain arrows, clamped to the list', () => {
    expect(gridKeyAction(key('ArrowDown'), 2, 5)).toEqual({ type: 'move', index: 3, select: 'replace' });
    expect(gridKeyAction(key('ArrowDown'), 4, 5)).toEqual({ type: 'move', index: 4, select: 'replace' });
    expect(gridKeyAction(key('ArrowUp'), 0, 5)).toEqual({ type: 'move', index: 0, select: 'replace' });
  });

  it('starts at the first row when ArrowUp is pressed with no active row, and at 0 on ArrowDown', () => {
    expect(gridKeyAction(key('ArrowUp'), -1, 5)).toEqual({ type: 'move', index: 0, select: 'replace' });
    expect(gridKeyAction(key('ArrowDown'), -1, 5)).toEqual({ type: 'move', index: 0, select: 'replace' });
  });

  it('extends with Shift and only moves with Ctrl or Cmd', () => {
    expect(gridKeyAction(key('ArrowDown', { shiftKey: true }), 1, 5)).toMatchObject({ select: 'extend' });
    expect(gridKeyAction(key('ArrowDown', { ctrlKey: true }), 1, 5)).toMatchObject({ select: 'none' });
    expect(gridKeyAction(key('ArrowDown', { metaKey: true, shiftKey: true }), 1, 5)).toMatchObject({ select: 'none' });
  });

  it('pages by 10 and jumps with Home/End', () => {
    expect(gridKeyAction(key('PageDown'), 2, 50)).toMatchObject({ index: 12 });
    expect(gridKeyAction(key('PageUp'), 4, 50)).toMatchObject({ index: 0 });
    expect(gridKeyAction(key('Home'), 20, 50)).toMatchObject({ index: 0 });
    expect(gridKeyAction(key('End'), 20, 50)).toMatchObject({ index: 49 });
  });

  it('selects on Enter, toggles on Ctrl/Cmd+Enter, opens the menu on ContextMenu and Shift+F10', () => {
    expect(gridKeyAction(key('Enter'), 1, 5)).toEqual({ type: 'select' });
    expect(gridKeyAction(key('Enter', { ctrlKey: true }), 1, 5)).toEqual({ type: 'toggle' });
    expect(gridKeyAction(key('ContextMenu'), 1, 5)).toEqual({ type: 'menu' });
    expect(gridKeyAction(key('F10', { shiftKey: true }), 1, 5)).toEqual({ type: 'menu' });
    expect(gridKeyAction(key('F10'), 1, 5)).toBeNull();
  });

  it('needs an active row for Enter and the menu, and leaves Space alone', () => {
    expect(gridKeyAction(key('Enter'), -1, 5)).toBeNull();
    expect(gridKeyAction(key('ContextMenu'), -1, 5)).toBeNull();
    expect(gridKeyAction(key(' '), 1, 5)).toBeNull();
  });
});
