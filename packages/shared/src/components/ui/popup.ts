import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { tabWrapAction } from './keyboard-logic';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Keyboard-reachable, rendered descendants of `root`, in DOM order. */
export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true',
  );
}

/** Marks the element that receives focus when a popup closes and its opener is gone or disabled. */
export const FOCUS_FALLBACK_ATTRIBUTE = 'data-focus-fallback';
const FOCUS_FALLBACK_SELECTOR = `[${FOCUS_FALLBACK_ATTRIBUTE}]`;

/**
 * Moves focus into `ref` on mount (to the element `pickInitial` returns, else the root itself) and
 * gives it back to the element that had it before when the popup unmounts (or, if that element is
 * detached or disabled, to the element marked with `data-focus-fallback`).
 */
export function useFocusScope(
  ref: RefObject<HTMLElement | null>,
  pickInitial: (root: HTMLElement) => HTMLElement | null | undefined,
): void {
  const pickRef = useRef(pickInitial);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (pickRef.current(root) ?? root).focus({ preventScroll: true });
    return () => {
      if (opener && opener.isConnected && !opener.matches(':disabled')) {
        opener.focus({ preventScroll: true });
        return;
      }
      document.querySelector<HTMLElement>(FOCUS_FALLBACK_SELECTOR)?.focus({ preventScroll: true });
    };
  }, [ref]);
}

/** Calls `onClose` when a pointer goes down outside `ref`. */
export function useOutsidePointerDown(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [ref]);
}

const VIEWPORT_MARGIN = 8;

/**
 * Position for a fixed popup anchored at a point, kept inside the viewport once its real size is
 * known (measured before paint, so there is no visible jump). `above-center` centres the popup on
 * the anchor and places it above it.
 */
export function useClampedPosition(
  ref: RefObject<HTMLElement | null>,
  anchor: { x: number; y: number },
  placement: 'below' | 'above-center' = 'below',
): { left: number; top: number } {
  const [pos, setPos] = useState({ left: anchor.x, top: anchor.y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const wantedLeft = placement === 'above-center' ? anchor.x - width / 2 : anchor.x;
    const wantedTop = placement === 'above-center' ? anchor.y - height - VIEWPORT_MARGIN : anchor.y;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(wantedLeft, window.innerWidth - width - VIEWPORT_MARGIN));
    const top = Math.max(VIEWPORT_MARGIN, Math.min(wantedTop, window.innerHeight - height - VIEWPORT_MARGIN));
    setPos({ left, top });
  }, [ref, anchor.x, anchor.y, placement]);
  return pos;
}

/**
 * Keeps Tab and Shift+Tab inside `root`; call from the keydown handler of a modal surface. Ignores
 * events another trap already handled and stops propagation once it acts, so nested traps do not fight.
 */
export function trapTab(e: React.KeyboardEvent<HTMLElement>, root: HTMLElement): void {
  if (e.key !== 'Tab' || e.defaultPrevented) return;
  const focusable = getFocusable(root);
  const action = tabWrapAction(e.shiftKey, focusable.indexOf(document.activeElement as HTMLElement), focusable.length);
  if (action === null) return;
  e.preventDefault();
  e.stopPropagation();
  if (action === 'first') focusable[0]?.focus();
  else if (action === 'last') focusable[focusable.length - 1]?.focus();
}
