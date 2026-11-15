import type { Header } from '@tanstack/react-table';
import type { RefObject } from 'react';
import type { Torrent } from '../../types/torrent';
import { moveColumnOrder } from './column-utils';

const RESIZE_STEP = 16;

interface Options {
  headerRowRef: RefObject<HTMLDivElement | null>;
  visibleColumnIds: string[];
  columnOrder: string[];
  columnSizing: Record<string, number>;
  setColumnOrder: (order: string[]) => void;
  setColumnSizing: (sizing: Record<string, number>) => void;
  openColumnsMenuAt: (el: HTMLElement) => void;
}

/**
 * Keyboard model of the column headers: arrows move between headers, Home/End jump, Alt+arrow
 * reorders, Shift+arrow resizes, Enter/Space sorts, ContextMenu/Shift+F10 opens the columns menu.
 */
export function useHeaderKeyboard({
  headerRowRef,
  visibleColumnIds,
  columnOrder,
  columnSizing,
  setColumnOrder,
  setColumnSizing,
  openColumnsMenuAt,
}: Options) {
  return (e: React.KeyboardEvent<HTMLDivElement>, header: Header<Torrent, unknown>) => {
    const cells = Array.from(
      headerRowRef.current?.querySelectorAll<HTMLElement>('[role="columnheader"][tabindex]') ?? [],
    );
    const index = cells.indexOf(e.currentTarget);
    const colId = header.column.id;
    const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      header.column.getToggleSortingHandler()?.(e);
    } else if (direction !== 0 && e.altKey) {
      e.preventDefault();
      setColumnOrder(moveColumnOrder(columnOrder, visibleColumnIds, colId, direction));
    } else if (direction !== 0 && e.shiftKey) {
      e.preventDefault();
      const min = header.column.columnDef.minSize ?? 40;
      setColumnSizing({ ...columnSizing, [colId]: Math.max(min, header.getSize() + direction * RESIZE_STEP) });
    } else if (direction !== 0) {
      e.preventDefault();
      cells[index + direction]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      cells[e.key === 'Home' ? 0 : cells.length - 1]?.focus();
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      openColumnsMenuAt(e.currentTarget);
    }
  };
}
