import { afterEach, describe, expect, it, vi } from 'vitest';
import { trapTab } from './popup';

interface FakeEl {
  focus: ReturnType<typeof vi.fn>;
  getClientRects: () => number[];
  getAttribute: () => null;
}

const fakeEl = (): FakeEl => ({ focus: vi.fn(), getClientRects: () => [1], getAttribute: () => null });

function setup(count: number, activeIndex: number) {
  const els = Array.from({ length: count }, fakeEl);
  const root = { querySelectorAll: () => els } as unknown as HTMLElement;
  vi.stubGlobal('document', { activeElement: activeIndex >= 0 ? els[activeIndex] : root });
  return { els, root };
}

function tabEvent(init: { shiftKey?: boolean; defaultPrevented?: boolean; key?: string } = {}) {
  return {
    key: init.key ?? 'Tab',
    shiftKey: init.shiftKey ?? false,
    defaultPrevented: init.defaultPrevented ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('trapTab', () => {
  it('wraps Tab from the last element to the first and stops propagation', () => {
    const { els, root } = setup(3, 2);
    const e = tabEvent();
    trapTab(e as never, root);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(els[0]?.focus).toHaveBeenCalled();
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    const { els, root } = setup(3, 0);
    trapTab(tabEvent({ shiftKey: true }) as never, root);
    expect(els[2]?.focus).toHaveBeenCalled();
  });

  it('wraps Shift+Tab from the root itself', () => {
    const { els, root } = setup(2, -1);
    trapTab(tabEvent({ shiftKey: true }) as never, root);
    expect(els[1]?.focus).toHaveBeenCalled();
  });

  it('leaves Tab in the middle alone', () => {
    const { els, root } = setup(3, 1);
    const e = tabEvent();
    trapTab(e as never, root);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(e.stopPropagation).not.toHaveBeenCalled();
    els.forEach((el) => expect(el.focus).not.toHaveBeenCalled());
  });

  it('swallows Tab when nothing is focusable', () => {
    const { root } = setup(0, -1);
    const e = tabEvent();
    trapTab(e as never, root);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('does nothing for an event an inner trap already handled', () => {
    const { els, root } = setup(3, 2);
    const e = tabEvent({ defaultPrevented: true });
    trapTab(e as never, root);
    expect(e.stopPropagation).not.toHaveBeenCalled();
    expect(els[0]?.focus).not.toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const { root } = setup(3, 2);
    const e = tabEvent({ key: 'a' });
    trapTab(e as never, root);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
