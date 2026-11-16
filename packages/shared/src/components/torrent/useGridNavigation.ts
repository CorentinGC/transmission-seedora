import { useCallback, useState } from 'react';
import { gridKeyAction } from './grid-keys';

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
      const action = gridKeyAction(e, activeIndex, rowIds.length);
      if (!action) return;
      e.preventDefault();
      if (action.type === 'move') {
        const id = rowIds[action.index];
        setActiveId(id);
        scrollToIndex(action.index);
        if (action.select === 'extend') extendTo(id);
        else if (action.select === 'replace') select(id);
        return;
      }
      const id = rowIds[activeIndex];
      if (action.type === 'toggle') toggle(id);
      else if (action.type === 'select') select(id);
      else openMenu(id);
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
