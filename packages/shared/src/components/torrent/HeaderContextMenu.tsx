import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Column } from '@tanstack/react-table';
import type { Torrent } from '../../types/torrent';

interface Props {
  x: number;
  y: number;
  columns: Column<Torrent, unknown>[];
  visibility: Record<string, boolean>;
  onToggle: (colId: string) => void;
  onClose: () => void;
}

export function HeaderContextMenu({ x, y, columns, visibility, onToggle, onClose }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Clamp position to viewport
  const menuWidth = 220;
  const menuHeight = 400;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-md border bg-popover shadow-lg py-1 text-sm"
      style={{ left, top, width: menuWidth, maxHeight: menuHeight, overflowY: 'auto' }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b mb-1">
        {t('columnMenu.setupColumns')}
      </div>
      {columns.map((col) => {
        const colId = col.id;
        const header = typeof col.columnDef.header === 'string' ? col.columnDef.header : colId;
        const isVisible = visibility[colId] !== false;
        const isLocked = colId === 'name';

        return (
          <label
            key={colId}
            className={`flex items-center gap-2 px-3 py-1 hover:bg-accent cursor-pointer ${isLocked ? 'opacity-50' : ''}`}
          >
            <input
              type="checkbox"
              checked={isVisible}
              disabled={isLocked}
              onChange={() => onToggle(colId)}
              className="rounded border-muted-foreground"
            />
            <span className="text-xs">{header}</span>
          </label>
        );
      })}
    </div>
  );
}
