import { useEffect, useRef, useState } from 'react';
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
  Tag,
} from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';
import { RemoveTorrentDialog } from './RemoveTorrentDialog';
import { SetLocationDialog } from './SetLocationDialog';
import { RenameTorrentDialog } from './RenameTorrentDialog';
import { ContextMenuItem as MenuItem, ContextMenuSeparator as Separator } from '../ui';

interface Props {
  x: number;
  y: number;
  torrentIds: number[];
  onClose: () => void;
}

export function TorrentContextMenu({ x, y, torrentIds, onClose }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
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

  const singleTorrent = torrentIds.length === 1 ? torrents.get(torrentIds[0]) : null;

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

  const copyMagnet = () => {
    if (singleTorrent?.magnetLink) {
      navigator.clipboard.writeText(singleTorrent.magnetLink);
    }
    onClose();
  };

  if (showRemove) return <RemoveTorrentDialog ids={torrentIds} onClose={() => { setShowRemove(false); onClose(); }} />;
  if (showLocation) return <SetLocationDialog ids={torrentIds} currentLocation={singleTorrent?.downloadDir} onClose={() => { setShowLocation(false); onClose(); }} />;
  if (showRename && singleTorrent) return <RenameTorrentDialog torrentId={singleTorrent.id} currentName={singleTorrent.name} onClose={() => { setShowRename(false); onClose(); }} />;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-56 rounded-md border bg-popover shadow-lg py-1 text-sm"
      style={{ left: x, top: y }}
    >
      <MenuItem icon={<Play size={14} />} label={t('contextMenu.start')} onClick={() => act(() => startTorrents(torrentIds))} />
      <MenuItem icon={<Zap size={14} />} label={t('contextMenu.forceStart')} onClick={() => act(() => startNowTorrents(torrentIds))} />
      <MenuItem icon={<Pause size={14} />} label={t('contextMenu.stop')} onClick={() => act(() => stopTorrents(torrentIds))} />
      <Separator />
      <MenuItem icon={<CheckCircle size={14} />} label={t('contextMenu.verify')} onClick={() => act(() => verifyTorrents(torrentIds))} />
      <MenuItem icon={<RefreshCw size={14} />} label={t('contextMenu.reannounce')} onClick={() => act(() => reannounceTorrents(torrentIds))} />
      <Separator />
      <MenuItem icon={<FolderOpen size={14} />} label={t('contextMenu.setLocation')} onClick={() => setShowLocation(true)} />
      {singleTorrent && (
        <MenuItem icon={<Edit3 size={14} />} label={t('contextMenu.rename')} onClick={() => setShowRename(true)} />
      )}
      {singleTorrent && (
        <MenuItem icon={<Copy size={14} />} label={t('contextMenu.copyMagnet')} onClick={copyMagnet} />
      )}
      <Separator />
      {/* Priority submenu */}
      <div className="px-2 py-1 text-xs text-muted-foreground">{t('contextMenu.priority')}</div>
      <MenuItem label={t('priority.high')} onClick={() => act(() => setTorrentProps(torrentIds, { bandwidthPriority: 1 }))} indent />
      <MenuItem label={t('priority.normal')} onClick={() => act(() => setTorrentProps(torrentIds, { bandwidthPriority: 0 }))} indent />
      <MenuItem label={t('priority.low')} onClick={() => act(() => setTorrentProps(torrentIds, { bandwidthPriority: -1 }))} indent />
      <Separator />
      {/* Queue submenu */}
      <div className="px-2 py-1 text-xs text-muted-foreground">{t('contextMenu.queue')}</div>
      <MenuItem icon={<ChevronsUp size={14} />} label={t('contextMenu.moveToTop')} onClick={() => act(() => queueMove(torrentIds, 'top'))} indent />
      <MenuItem icon={<ArrowUp size={14} />} label={t('contextMenu.moveUp')} onClick={() => act(() => queueMove(torrentIds, 'up'))} indent />
      <MenuItem icon={<ArrowDown size={14} />} label={t('contextMenu.moveDown')} onClick={() => act(() => queueMove(torrentIds, 'down'))} indent />
      <MenuItem icon={<ChevronsDown size={14} />} label={t('contextMenu.moveToBottom')} onClick={() => act(() => queueMove(torrentIds, 'bottom'))} indent />
      <Separator />
      <MenuItem icon={<Trash2 size={14} />} label={t('contextMenu.remove')} onClick={() => setShowRemove(true)} className="text-destructive" />
    </div>
  );
}
