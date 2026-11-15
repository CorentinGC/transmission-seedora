import { useRef } from 'react';
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
  const typeahead = useRef({ buffer: '', at: 0 });
  const pos = useClampedPosition(ref, { x, y });
  useFocusScope(ref, (root) => menuItems(root)[0]);
  useOutsidePointerDown(ref, onClose);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const items = menuItems(ref.current);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => {
      e.preventDefault();
      items[(index + items.length) % items.length]?.focus();
    };

    switch (e.key) {
      case 'ArrowDown':
        focusAt(current + 1);
        return;
      case 'ArrowUp':
        focusAt(current === -1 ? items.length - 1 : current - 1);
        return;
      case 'Home':
        focusAt(0);
        return;
      case 'End':
        focusAt(items.length - 1);
        return;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      case 'Tab':
        e.preventDefault();
        onClose();
        return;
    }

    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.key === ' ') return;
    const now = Date.now();
    const state = typeahead.current;
    state.buffer = now - state.at > 700 ? e.key.toLowerCase() : state.buffer + e.key.toLowerCase();
    state.at = now;
    const start = state.buffer.length === 1 ? current + 1 : current;
    const ordered = [...items.slice(start), ...items.slice(0, start)];
    const match = ordered.find((el) => el.textContent?.trim().toLowerCase().startsWith(state.buffer));
    if (match) {
      e.preventDefault();
      match.focus();
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
