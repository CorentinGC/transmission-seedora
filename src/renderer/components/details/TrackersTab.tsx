import { useEffect, useState } from 'react';
import type { Torrent, TorrentTrackerStats } from '../../types/torrent';
import { useTorrentStore } from '../../stores/torrent-store';

interface Props {
  torrent: Torrent;
}

export function TrackersTab({ torrent }: Props) {
  const [trackerStats, setTrackerStats] = useState<TorrentTrackerStats[]>([]);
  const [newTracker, setNewTracker] = useState('');
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

  return (
    <div className="text-xs space-y-2">
      <div className="flex items-center gap-2 px-1 py-1 font-medium text-muted-foreground border-b">
        <span className="w-8">Tier</span>
        <span className="flex-1">Announce URL</span>
        <span className="w-16 text-right">Seeds</span>
        <span className="w-16 text-right">Leechers</span>
        <span className="w-20">Status</span>
        <span className="w-12" />
      </div>
      {trackerStats.map((ts) => (
        <div key={ts.id} className="flex items-center gap-2 px-1 py-0.5 hover:bg-accent">
          <span className="w-8 text-muted-foreground">{ts.tier}</span>
          <span className="flex-1 truncate">{ts.announce}</span>
          <span className="w-16 text-right">{ts.seederCount >= 0 ? ts.seederCount : '-'}</span>
          <span className="w-16 text-right">{ts.leecherCount >= 0 ? ts.leecherCount : '-'}</span>
          <span className="w-20">
            {ts.lastAnnounceSucceeded ? 'OK' : ts.lastAnnounceResult || 'N/A'}
          </span>
          <button
            className="w-12 text-red-500 hover:underline"
            onClick={() => removeTracker(ts.announce)}
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2 border-t">
        <input
          type="text"
          placeholder="Add tracker URL..."
          value={newTracker}
          onChange={(e) => setNewTracker(e.target.value)}
          className="flex-1 h-7 px-2 text-xs rounded border bg-background"
          onKeyDown={(e) => e.key === 'Enter' && addTracker()}
        />
        <button
          className="h-7 px-3 text-xs rounded border hover:bg-accent"
          onClick={addTracker}
        >
          Add
        </button>
      </div>
    </div>
  );
}
