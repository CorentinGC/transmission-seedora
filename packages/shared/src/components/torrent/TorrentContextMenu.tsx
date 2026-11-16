import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Zap,
  Pause,
  CheckCircle,
  RefreshCw,
  Trash2,
  FolderOpen,
  Edit3,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';
import { RemoveTorrentDialog } from './RemoveTorrentDialog';
import { SetLocationDialog } from './SetLocationDialog';
import { RenameTorrentDialog } from './RenameTorrentDialog';
import { Menu, ContextMenuItem as MenuItem, ContextMenuGroup as Group, ContextMenuSeparator as Separator } from '../ui';

interface Props {
  x: number;
  y: number;
  torrentIds: number[];
  onClose: () => void;
}

export function TorrentContextMenu({ x, y, torrentIds, onClose }: Props) {
  const { t } = useTranslation();
  const startTorrents = useTorrentStore((s) => s.startTorrents);
  const startNowTorrents = useTorrentStore((s) => s.startNowTorrents);
  const stopTorrents = useTorrentStore((s) => s.stopTorrents);
  const verifyTorrents = useTorrentStore((s) => s.verifyTorrents);
  const reannounceTorrents = useTorrentStore((s) => s.reannounceTorrents);
  const queueMove = useTorrentStore((s) => s.queueMove);
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);
  const torrents = useTorrentStore((s) => s.torrents);

  const [showRemove, setShowRemove] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showRename, setShowRename] = useState(false);

  const [onlyId] = torrentIds;
  const singleTorrent = torrentIds.length === 1 && onlyId !== undefined ? torrents.get(onlyId) : null;

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  const copyMagnet = () => {
    if (singleTorrent?.magnetLink) {
      navigator.clipboard.writeText(singleTorrent.magnetLink);
    }
    onClose();
  };

  if (showRemove)
    return (
      <RemoveTorrentDialog
        ids={torrentIds}
        onClose={() => {
          setShowRemove(false);
          onClose();
        }}
      />
    );
  if (showLocation)
    return (
      <SetLocationDialog
        ids={torrentIds}
        currentLocation={singleTorrent?.downloadDir}
        onClose={() => {
          setShowLocation(false);
          onClose();
        }}
      />
    );
  if (showRename && singleTorrent)
    return (
      <RenameTorrentDialog
        torrentId={singleTorrent.id}
        currentName={singleTorrent.name}
        onClose={() => {
          setShowRename(false);
          onClose();
        }}
      />
    );

  return (
    <Menu x={x} y={y} label={t('contextMenu.title')} onClose={onClose}>
      <MenuItem
        icon={<Play size={14} />}
        label={t('contextMenu.start')}
        onClick={() => act(() => startTorrents(torrentIds))}
      />
      <MenuItem
        icon={<Zap size={14} />}
        label={t('contextMenu.forceStart')}
        onClick={() => act(() => startNowTorrents(torrentIds))}
      />
      <MenuItem
        icon={<Pause size={14} />}
        label={t('contextMenu.stop')}
        onClick={() => act(() => stopTorrents(torrentIds))}
      />
      <Separator />
      <MenuItem
        icon={<CheckCircle size={14} />}
        label={t('contextMenu.verify')}
        onClick={() => act(() => verifyTorrents(torrentIds))}
      />
      <MenuItem
        icon={<RefreshCw size={14} />}
        label={t('contextMenu.reannounce')}
        onClick={() => act(() => reannounceTorrents(torrentIds))}
      />
      <Separator />
      <MenuItem
        icon={<FolderOpen size={14} />}
        label={t('contextMenu.setLocation')}
        onClick={() => setShowLocation(true)}
      />
      {singleTorrent && (
        <MenuItem icon={<Edit3 size={14} />} label={t('contextMenu.rename')} onClick={() => setShowRename(true)} />
      )}
      {singleTorrent && <MenuItem icon={<Copy size={14} />} label={t('contextMenu.copyMagnet')} onClick={copyMagnet} />}
      <Separator />
      <Group label={t('contextMenu.priority')}>
        <MenuItem
          label={t('priority.high')}
          onClick={() => act(() => setTorrentProps(torrentIds, { bandwidthPriority: 1 }))}
          indent
        />
        <MenuItem
          label={t('priority.normal')}
          onClick={() => act(() => setTorrentProps(torrentIds, { bandwidthPriority: 0 }))}
          indent
        />
        <MenuItem
          label={t('priority.low')}
          onClick={() => act(() => setTorrentProps(torrentIds, { bandwidthPriority: -1 }))}
          indent
        />
      </Group>
      <Separator />
      <Group label={t('contextMenu.queue')}>
        <MenuItem
          icon={<ChevronsUp size={14} />}
          label={t('contextMenu.moveToTop')}
          onClick={() => act(() => queueMove(torrentIds, 'top'))}
          indent
        />
        <MenuItem
          icon={<ArrowUp size={14} />}
          label={t('contextMenu.moveUp')}
          onClick={() => act(() => queueMove(torrentIds, 'up'))}
          indent
        />
        <MenuItem
          icon={<ArrowDown size={14} />}
          label={t('contextMenu.moveDown')}
          onClick={() => act(() => queueMove(torrentIds, 'down'))}
          indent
        />
        <MenuItem
          icon={<ChevronsDown size={14} />}
          label={t('contextMenu.moveToBottom')}
          onClick={() => act(() => queueMove(torrentIds, 'bottom'))}
          indent
        />
      </Group>
      <Separator />
      <MenuItem
        icon={<Trash2 size={14} />}
        label={t('contextMenu.remove')}
        onClick={() => setShowRemove(true)}
        className="text-destructive-text"
      />
    </Menu>
  );
}
