import { useRef } from 'react';
import { isTypeaheadKey, menuNavigationTarget, typeaheadMatch, type TypeaheadState } from './keyboard-logic';
import { useClampedPosition, useFocusScope, useOutsidePointerDown } from './popup';

interface MenuProps {
  x: number;
  y: number;
  /** Accessible name of the menu. */
  label: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

const ITEM_SELECTOR = '[role^="menuitem"]:not([disabled])';

function menuItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

/**
 * Context menu opened at a point. Arrow keys, Home/End and typeahead move between items, Enter
 * activates, Escape or Tab closes and focus returns to where it was. It stays inside the viewport.
 */
export function Menu({ x, y, label, onClose, className = 'w-56', children }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const typeahead = useRef<TypeaheadState>({ buffer: '', at: 0 });
  const pos = useClampedPosition(ref, { x, y });
  useFocusScope(ref, (root) => menuItems(root)[0]);
  useOutsidePointerDown(ref, onClose);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const items = menuItems(ref.current);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const target = menuNavigationTarget(e.key, current, items.length);
    if (target !== null) {
      e.preventDefault();
      items[target]?.focus();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      onClose();
      return;
    }
    if (!isTypeaheadKey(e)) return;
    const labels = items.map((el) => el.textContent ?? '');
    const match = typeaheadMatch(typeahead.current, e.key, Date.now(), labels, current);
    if (match !== -1) {
      e.preventDefault();
      items[match]?.focus();
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={`fixed z-50 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-md border bg-popover shadow-lg py-1 text-sm focus:outline-none ${className}`}
      style={{ left: pos.left, top: pos.top }}
    >
      {children}
    </div>
  );
}
