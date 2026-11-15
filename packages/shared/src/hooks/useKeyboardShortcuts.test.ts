import { describe, expect, it, vi } from 'vitest';
import { handleDeleteKey, handleSpaceKey, isEditableTarget } from './useKeyboardShortcuts';

const el = (props: Record<string, unknown>) => props as unknown as EventTarget;
const press = (key: string, target: EventTarget | null) => ({ key, target, preventDefault: vi.fn() });

describe('isEditableTarget', () => {
  it('detects input, textarea, select and contenteditable', () => {
    expect(isEditableTarget(el({ tagName: 'INPUT' }))).toBe(true);
    expect(isEditableTarget(el({ tagName: 'TEXTAREA' }))).toBe(true);
    expect(isEditableTarget(el({ tagName: 'SELECT' }))).toBe(true);
    expect(isEditableTarget(el({ tagName: 'DIV', isContentEditable: true }))).toBe(true);
  });
  it('ignores other elements and null', () => {
    expect(isEditableTarget(el({ tagName: 'DIV', isContentEditable: false }))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('handleDeleteKey', () => {
  it('opens the dialog with a selection outside inputs', () => {
    const open = vi.fn();
    const e = press('Delete', el({ tagName: 'DIV' }));
    expect(handleDeleteKey(e, 2, open, true)).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    expect(e.preventDefault).toHaveBeenCalled();
  });
  it('does nothing without a selection', () => {
    const open = vi.fn();
    expect(handleDeleteKey(press('Delete', el({ tagName: 'DIV' })), 0, open, true)).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
  it('does nothing while typing in an input or contenteditable', () => {
    const open = vi.fn();
    expect(handleDeleteKey(press('Delete', el({ tagName: 'INPUT' })), 1, open, true)).toBe(false);
    expect(handleDeleteKey(press('Delete', el({ tagName: 'DIV', isContentEditable: true })), 1, open, true)).toBe(
      false,
    );
    expect(open).not.toHaveBeenCalled();
  });
  it('ignores other keys', () => {
    const open = vi.fn();
    expect(handleDeleteKey(press('Backspace', el({ tagName: 'DIV' })), 1, open, true)).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
  it('does nothing unless connected', () => {
    const open = vi.fn();
    const e = press('Delete', el({ tagName: 'DIV' }));
    expect(handleDeleteKey(e, 1, open, false)).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
  it('does nothing when focus is inside a dialog', () => {
    const open = vi.fn();
    const inDialog = el({ tagName: 'BUTTON', closest: (sel: string) => (sel === '[role="dialog"]' ? {} : null) });
    expect(handleDeleteKey(press('Delete', inDialog), 1, open, true)).toBe(false);
    expect(open).not.toHaveBeenCalled();
    const outside = el({ tagName: 'BUTTON', closest: () => null });
    expect(handleDeleteKey(press('Delete', outside), 1, open, true)).toBe(true);
  });
});

describe('handleSpaceKey', () => {
  const key = (target: object, k = ' ') => ({
    key: k,
    target: target as unknown as EventTarget,
    preventDefault: vi.fn(),
  });
  const within = (selectors: string[]) => ({
    closest: (sel: string) => (selectors.some((s) => sel.includes(s)) ? {} : null),
  });

  it('toggles on body or a plain grid container', () => {
    const toggle = vi.fn();
    const e = key(within([]));
    expect(handleSpaceKey(e, [1], toggle)).toBe(true);
    expect(toggle).toHaveBeenCalledWith([1]);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('ignores Space on interactive controls, dialogs and menus', () => {
    for (const s of [
      'button',
      'role="tab"',
      'role="menuitem"',
      'role="checkbox"',
      'role="gridcell"',
      'role="row"',
      'role="dialog"',
      'role="menu"',
    ]) {
      const toggle = vi.fn();
      const e = key(within([s]));
      expect(handleSpaceKey(e, [1], toggle)).toBe(false);
      expect(toggle).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
  });

  it('ignores other keys and an empty selection', () => {
    expect(handleSpaceKey(key(within([]), 'a'), [1], vi.fn())).toBe(false);
    expect(handleSpaceKey(key(within([])), [], vi.fn())).toBe(false);
  });
});
