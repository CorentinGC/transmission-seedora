/** Pure key mapping of the torrent grid (no DOM), so it can be unit-tested in the node environment. */

export const GRID_PAGE_SIZE = 10;

export type GridKeyAction =
  | { type: 'move'; index: number; select: 'replace' | 'extend' | 'none' }
  | { type: 'select' }
  | { type: 'toggle' }
  | { type: 'menu' };

export interface GridKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * Maps a key press to a grid action. `activeIndex` is -1 when no row is active; moves are clamped
 * to the list. Returns null for keys the grid does not handle (including Enter/menu keys without
 * an active row).
 */
export function gridKeyAction(e: GridKeyEvent, activeIndex: number, rowCount: number): GridKeyAction | null {
  if (rowCount === 0) return null;
  const last = rowCount - 1;
  const move = (index: number): GridKeyAction => ({
    type: 'move',
    index: Math.max(0, Math.min(last, index)),
    select: e.ctrlKey || e.metaKey ? 'none' : e.shiftKey ? 'extend' : 'replace',
  });

  switch (e.key) {
    case 'ArrowDown':
      return move(activeIndex + 1);
    case 'ArrowUp':
      return move(activeIndex === -1 ? 0 : activeIndex - 1);
    case 'PageDown':
      return move(activeIndex + GRID_PAGE_SIZE);
    case 'PageUp':
      return move(activeIndex - GRID_PAGE_SIZE);
    case 'Home':
      return move(0);
    case 'End':
      return move(last);
  }

  if (activeIndex === -1) return null;
  if (e.key === 'Enter') return e.ctrlKey || e.metaKey ? { type: 'toggle' } : { type: 'select' };
  if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) return { type: 'menu' };
  return null;
}
