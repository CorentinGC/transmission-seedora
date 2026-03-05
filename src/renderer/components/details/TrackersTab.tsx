import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import type { Torrent, TorrentTrackerStats } from '../../types/torrent';
import { useTorrentStore } from '../../stores/torrent-store';
import { Button } from '../ui';

interface Props {
  torrent: Torrent;
}

export function TrackersTab({ torrent }: Props) {
  const { t } = useTranslation();
  const [trackerStats, setTrackerStats] = useState<TorrentTrackerStats[]>([]);
  const [newTracker, setNewTracker] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);

  const fetchTrackers = useCallback(() => {
    window.api
      .rpcTorrentGet(['trackerStats', 'trackerList'], [torrent.id])
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data as { torrents: { trackerStats: TorrentTrackerStats[]; trackerList: string }[] };
          if (d.torrents?.[0]?.trackerStats) setTrackerStats(d.torrents[0].trackerStats);
        }
      });
  }, [torrent.id]);

  useEffect(() => {
    let cancelled = false;
    window.api
      .rpcTorrentGet(['trackerStats', 'trackerList'], [torrent.id])
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          const d = res.data as { torrents: { trackerStats: TorrentTrackerStats[]; trackerList: string }[] };
          if (d.torrents?.[0]?.trackerStats) setTrackerStats(d.torrents[0].trackerStats);
        }
      });
    return () => { cancelled = true; };
  }, [torrent.id]);

  const getTrackerList = async (): Promise<string> => {
    const res = await window.api.rpcTorrentGet(['trackerList'], [torrent.id]);
    if (res.success && res.data) {
      const d = res.data as { torrents: { trackerList: string }[] };
      return d.torrents?.[0]?.trackerList ?? '';
    }
    return '';
  };

  const addTracker = async () => {
    if (!newTracker.trim()) return;
    setLoadingAction('add');
    try {
      const current = await getTrackerList();
      const updated = current ? `${current}\n\n${newTracker.trim()}` : newTracker.trim();
      await setTorrentProps([torrent.id], { trackerList: updated });
      setNewTracker('');
      fetchTrackers();
    } finally {
      setLoadingAction(null);
    }
  };

  const removeTracker = async (announce: string) => {
    setLoadingAction(`remove-${announce}`);
    try {
      const current = await getTrackerList();
      const tiers = current.split('\n\n');
      const updated = tiers
        .map((tier) => tier.split('\n').filter((l) => l.trim() !== announce).join('\n'))
        .filter((tier) => tier.trim() !== '');
      await setTorrentProps([torrent.id], { trackerList: updated.join('\n\n') });
      fetchTrackers();
    } finally {
      setLoadingAction(null);
    }
  };

  const startEdit = (ts: TorrentTrackerStats) => {
    setEditingId(ts.id);
    setEditValue(ts.announce);
  };

  const saveEdit = async (oldAnnounce: string) => {
    if (!editValue.trim() || editValue.trim() === oldAnnounce) {
      setEditingId(null);
      return;
    }
    setLoadingAction(`save-${oldAnnounce}`);
    try {
      const current = await getTrackerList();
      const tiers = current.split('\n\n');
      const updated = tiers.map((tier) =>
        tier.split('\n').map((l) => (l.trim() === oldAnnounce ? editValue.trim() : l)).join('\n')
      );
      await setTorrentProps([torrent.id], { trackerList: updated.join('\n\n') });
      setEditingId(null);
      fetchTrackers();
    } finally {
      setLoadingAction(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="text-xs">
      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-muted-foreground font-medium border-b">
            <th className="text-left px-1.5 py-1 w-10">{t('trackersTab.tier')}</th>
            <th className="text-left px-1.5 py-1">{t('trackersTab.announceUrl')}</th>
            <th className="text-right px-1.5 py-1 w-16">{t('trackersTab.seeds')}</th>
            <th className="text-right px-1.5 py-1 w-16">{t('trackersTab.leechers')}</th>
            <th className="text-left px-1.5 py-1 w-24">{t('trackersTab.status')}</th>
            <th className="w-14" />
          </tr>
        </thead>
        <tbody>
          {trackerStats.map((ts) => (
            <tr key={ts.id} className="hover:bg-accent group">
              <td className="px-1.5 py-1 text-muted-foreground">{ts.tier}</td>
              <td className="px-1.5 py-1">
                {editingId === ts.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 h-6 px-1.5 text-xs rounded border bg-background"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(ts.announce);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => saveEdit(ts.announce)}
                      disabled={loadingAction === `save-${ts.announce}`}
                    >
                      <Check size={12} />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={cancelEdit}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                ) : (
                  <span
                    className="block truncate cursor-pointer hover:underline"
                    onDoubleClick={() => startEdit(ts)}
                    title={ts.announce}
                  >
                    {ts.announce}
                  </span>
                )}
              </td>
              <td className="px-1.5 py-1 text-right">{ts.seederCount >= 0 ? ts.seederCount : '-'}</td>
              <td className="px-1.5 py-1 text-right">{ts.leecherCount >= 0 ? ts.leecherCount : '-'}</td>
              <td className="px-1.5 py-1 max-w-24 truncate" title={ts.lastAnnounceSucceeded ? 'OK' : (ts.lastAnnounceResult || '')}>
                {ts.lastAnnounceSucceeded ? (
                  <span className="text-green-500">{t('trackersTab.ok')}</span>
                ) : (
                  <span className="text-muted-foreground">{ts.lastAnnounceResult || t('trackersTab.na')}</span>
                )}
              </td>
              <td className="px-1.5 py-1">
                {editingId !== ts.id && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => startEdit(ts)}
                      title={t('trackersTab.edit')}
                      className="p-1 h-5 w-5"
                    >
                      <Pencil size={12} />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => removeTracker(ts.announce)}
                      disabled={loadingAction === `remove-${ts.announce}`}
                      title={t('trackersTab.remove')}
                      className="p-1 h-5 w-5 text-destructive hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add tracker */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t px-1.5">
        <input
          type="text"
          placeholder={t('trackersTab.addPlaceholder')}
          value={newTracker}
          onChange={(e) => setNewTracker(e.target.value)}
          className="flex-1 h-7 px-2 text-xs rounded border bg-background"
          onKeyDown={(e) => e.key === 'Enter' && addTracker()}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={addTracker}
          disabled={!newTracker.trim() || loadingAction === 'add'}
          className="shrink-0 whitespace-nowrap"
        >
          <Plus size={14} className="mr-1" />
          {t('trackersTab.add')}
        </Button>
      </div>
    </div>
  );
}
