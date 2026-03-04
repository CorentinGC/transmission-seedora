import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Torrent, TorrentTrackerStats } from '../../types/torrent';
import { useTorrentStore } from '../../stores/torrent-store';

interface Props {
  torrent: Torrent;
}

export function TrackersTab({ torrent }: Props) {
  const { t } = useTranslation();
  const [trackerStats, setTrackerStats] = useState<TorrentTrackerStats[]>([]);
  const [newTracker, setNewTracker] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);

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

  const addTracker = () => {
    if (!newTracker.trim()) return;
    const current = torrent.trackerList ?? '';
    const updated = current ? `${current}\n\n${newTracker.trim()}` : newTracker.trim();
    setTorrentProps([torrent.id], { trackerList: updated });
    setNewTracker('');
  };

  const removeTracker = (announce: string) => {
    const lines = (torrent.trackerList ?? '').split('\n');
    const filtered = lines.filter((l) => l.trim() !== announce);
    setTorrentProps([torrent.id], { trackerList: filtered.join('\n') });
  };

  const startEdit = (ts: TorrentTrackerStats) => {
    setEditingId(ts.id);
    setEditValue(ts.announce);
  };

  const saveEdit = (oldAnnounce: string) => {
    if (!editValue.trim() || editValue.trim() === oldAnnounce) {
      setEditingId(null);
      return;
    }
    const lines = (torrent.trackerList ?? '').split('\n');
    const updated = lines.map((l) => (l.trim() === oldAnnounce ? editValue.trim() : l));
    setTorrentProps([torrent.id], { trackerList: updated.join('\n') });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="text-xs space-y-2">
      <div className="flex items-center gap-2 px-1 py-1 font-medium text-muted-foreground border-b">
        <span className="w-8">{t('trackersTab.tier')}</span>
        <span className="flex-1">{t('trackersTab.announceUrl')}</span>
        <span className="w-16 text-right">{t('trackersTab.seeds')}</span>
        <span className="w-16 text-right">{t('trackersTab.leechers')}</span>
        <span className="w-20">{t('trackersTab.status')}</span>
        <span className="w-24" />
      </div>
      {trackerStats.map((ts) => (
        <div key={ts.id} className="flex items-center gap-2 px-1 py-0.5 hover:bg-accent">
          <span className="w-8 text-muted-foreground">{ts.tier}</span>
          {editingId === ts.id ? (
            <div className="flex-1 flex items-center gap-1">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 h-6 px-1 text-xs rounded border bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(ts.announce);
                  if (e.key === 'Escape') cancelEdit();
                }}
              />
              <button
                className="text-green-500 hover:underline"
                onClick={() => saveEdit(ts.announce)}
              >
                {t('trackersTab.save')}
              </button>
              <button
                className="text-muted-foreground hover:underline"
                onClick={cancelEdit}
              >
                {t('trackersTab.cancel')}
              </button>
            </div>
          ) : (
            <>
              <span
                className="flex-1 truncate cursor-pointer hover:underline"
                onDoubleClick={() => startEdit(ts)}
                title={t('details.doubleClickEdit')}
              >
                {ts.announce}
              </span>
              <span className="w-16 text-right">{ts.seederCount >= 0 ? ts.seederCount : '-'}</span>
              <span className="w-16 text-right">{ts.leecherCount >= 0 ? ts.leecherCount : '-'}</span>
              <span className="w-20">
                {ts.lastAnnounceSucceeded ? t('trackersTab.ok') : ts.lastAnnounceResult || t('trackersTab.na')}
              </span>
              <div className="w-24 flex gap-1">
                <button
                  className="text-blue-500 hover:underline"
                  onClick={() => startEdit(ts)}
                >
                  {t('trackersTab.edit')}
                </button>
                <button
                  className="text-red-500 hover:underline"
                  onClick={() => removeTracker(ts.announce)}
                >
                  {t('trackersTab.remove')}
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2 border-t">
        <input
          type="text"
          placeholder={t('trackersTab.addPlaceholder')}
          value={newTracker}
          onChange={(e) => setNewTracker(e.target.value)}
          className="flex-1 h-7 px-2 text-xs rounded border bg-background"
          onKeyDown={(e) => e.key === 'Enter' && addTracker()}
        />
        <button
          className="h-7 px-3 text-xs rounded border hover:bg-accent"
          onClick={addTracker}
        >
          {t('trackersTab.add')}
        </button>
      </div>
    </div>
  );
}
