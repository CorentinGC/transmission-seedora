import { useTranslation } from 'react-i18next';
import { Popover } from '../ui';
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

  return (
    <Popover x={x} y={y} label={t('columnMenu.setupColumns')} onClose={onClose} className="w-56 py-1">
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
            className={`flex items-center gap-2 px-3 py-1 pointer-coarse:py-3 hover:bg-accent cursor-pointer ${isLocked ? 'opacity-50' : ''}`}
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
    </Popover>
  );
}
