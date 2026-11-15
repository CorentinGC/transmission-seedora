import { useTranslation } from 'react-i18next';
import { Menu, ContextMenuItem as MenuItem, ContextMenuGroup as Group, ContextMenuSeparator as Separator } from '../ui';
import { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_NORMAL } from './file-tree';

/** Context menu to set the priority of, or skip/download, the given files. */
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

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <Menu x={x} y={y} label={t('torrent.priority')} onClose={onClose} className="w-48">
      <Group label={t('torrent.priority')}>
        <MenuItem
          label={t('priority.high')}
          onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_HIGH))}
          checked={currentPriority === PRIORITY_HIGH}
        />
        <MenuItem
          label={t('priority.normal')}
          onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_NORMAL))}
          checked={currentPriority === PRIORITY_NORMAL}
        />
        <MenuItem
          label={t('priority.low')}
          onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_LOW))}
          checked={currentPriority === PRIORITY_LOW}
        />
      </Group>
      <Separator />
      <MenuItem
        label={isWanted ? t('filesTab.doNotDownload') : t('filesTab.download')}
        onClick={() => act(() => onToggleWanted(fileIndices, !isWanted))}
      />
    </Menu>
  );
}
