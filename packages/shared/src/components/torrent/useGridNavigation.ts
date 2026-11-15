import { useCallback, useState } from 'react';

const PAGE_SIZE = 10;

interface Options {
  /** Row ids in display order. */
  rowIds: number[];
  selectedIds: Set<number>;
  select: (id: number) => void;
  toggle: (id: number) => void;
  extendTo: (id: number) => void;
  scrollToIndex: (index: number) => void;
  /** Opens the row context menu for `id` (keyboard: ContextMenu key or Shift+F10). */
  openMenu: (id: number) => void;
}

/**
 * Keyboard model of the torrent grid. Focus stays on the grid element and the active row is
 * exposed through `aria-activedescendant`, so virtualised rows can unmount without losing it.
 * Arrows move and select; Ctrl/Cmd+Arrow only move; Shift+Arrow extends; Enter selects
 * (Ctrl/Cmd+Enter toggles). Space is left alone: it starts or stops the selection globally.
 */
export function useGridNavigation({ rowIds, selectedIds, select, toggle, extendTo, scrollToIndex, openMenu }: Options) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);

  const activeIndex = activeId === null ? -1 : rowIds.indexOf(activeId);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget || rowIds.length === 0) return;
      const last = rowIds.length - 1;
      const moveTo = (index: number) => {
        e.preventDefault();
        const next = Math.max(0, Math.min(last, index));
        const id = rowIds[next];
        setActiveId(id);
        scrollToIndex(next);
        if (e.ctrlKey || e.metaKey) return;
        if (e.shiftKey) extendTo(id);
        else select(id);
      };

      switch (e.key) {
        case 'ArrowDown':
          return moveTo(activeIndex + 1);
        case 'ArrowUp':
          return moveTo(activeIndex === -1 ? 0 : activeIndex - 1);
        case 'PageDown':
          return moveTo(activeIndex + PAGE_SIZE);
        case 'PageUp':
          return moveTo(activeIndex - PAGE_SIZE);
        case 'Home':
          return moveTo(0);
        case 'End':
          return moveTo(last);
      }

      if (activeIndex === -1) return;
      const id = rowIds[activeIndex];
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) toggle(id);
        else select(id);
      } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
        e.preventDefault();
        openMenu(id);
      }
    },
    [rowIds, activeIndex, select, toggle, extendTo, scrollToIndex, openMenu],
  );

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      setFocused(true);
      if (activeIndex !== -1 || rowIds.length === 0) return;
      setActiveId(rowIds.find((id) => selectedIds.has(id)) ?? rowIds[0]);
    },
    [activeIndex, rowIds, selectedIds],
  );

  const onBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (e.target === e.currentTarget) setFocused(false);
  }, []);

  return { activeId: activeIndex === -1 ? null : activeId, setActiveId, focused, onKeyDown, onFocus, onBlur };
}
