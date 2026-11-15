import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenuItem as MenuItem, ContextMenuSeparator as Separator } from '../ui';
import { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_NORMAL } from './file-tree';

/** Right-click menu to set the priority of, or skip/download, the given files. */
export function FileContextMenu({
  x,
  y,
  fileIndices,
  currentPriority,
  isWanted,
  onSetPriority,
  onToggleWanted,
  onClose,
}: {
  x: number;
  y: number;
  fileIndices: number[];
  currentPriority: number;
  isWanted: boolean;
  onSetPriority: (indices: number[], priority: number) => void;
  onToggleWanted: (indices: number[], wanted: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 w-48 rounded-md border bg-popover shadow-lg py-1 text-sm"
      style={{ left: x, top: y }}
    >
      <div className="px-2 py-1 text-xs text-muted-foreground">{t('torrent.priority')}</div>
      <MenuItem
        label={t('priority.high')}
        onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_HIGH))}
        indent
        className={currentPriority === PRIORITY_HIGH ? 'text-destructive-text font-medium' : ''}
      />
      <MenuItem
        label={t('priority.normal')}
        onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_NORMAL))}
        indent
        className={currentPriority === PRIORITY_NORMAL ? 'text-info font-medium' : ''}
      />
      <MenuItem
        label={t('priority.low')}
        onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_LOW))}
        indent
        className={currentPriority === PRIORITY_LOW ? 'font-medium' : ''}
      />
      <Separator />
      <MenuItem
        label={isWanted ? t('filesTab.doNotDownload') : t('filesTab.download')}
        onClick={() => act(() => onToggleWanted(fileIndices, !isWanted))}
      />
    </div>
  );
}
