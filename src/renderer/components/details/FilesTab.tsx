import { useEffect, useState } from 'react';
import type { Torrent, TorrentFile, TorrentFileStat } from '../../types/torrent';
import { formatBytes, formatPercent } from '../../lib/format';
import { useTorrentStore } from '../../stores/torrent-store';

interface Props {
  torrent: Torrent;
}

interface DetailedTorrentData {
  files: TorrentFile[];
  fileStats: TorrentFileStat[];
}

const PRIORITY_LABELS: Record<number, string> = {
  [-1]: 'Low',
  0: 'Normal',
  1: 'High',
};

export function FilesTab({ torrent }: Props) {
  const [data, setData] = useState<DetailedTorrentData | null>(null);
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);

  useEffect(() => {
    let cancelled = false;
    window.api
      .rpcTorrentGet(['files', 'fileStats'], [torrent.id])
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          const d = res.data as { torrents: DetailedTorrentData[] };
          if (d.torrents?.[0]) setData(d.torrents[0]);
        }
      });
    return () => { cancelled = true; };
  }, [torrent.id]);

  if (!data?.files) {
    return <div className="text-muted-foreground">Loading files...</div>;
  }

  const toggleWanted = (index: number, wanted: boolean) => {
    const key = wanted ? 'files-wanted' : 'files-unwanted';
    setTorrentProps([torrent.id], { [key]: [index] });
  };

  const setPriority = (index: number, priority: number) => {
    const key = priority === 1 ? 'priority-high' : priority === -1 ? 'priority-low' : 'priority-normal';
    setTorrentProps([torrent.id], { [key]: [index] });
  };

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2 px-1 py-1 font-medium text-muted-foreground border-b">
        <span className="w-6" />
        <span className="flex-1">Name</span>
        <span className="w-20 text-right">Size</span>
        <span className="w-16 text-right">Done</span>
        <span className="w-16 text-right">Priority</span>
      </div>
      {data.files.map((file, i) => {
        const stat = data.fileStats?.[i];
        const progress = file.length > 0 ? file.bytesCompleted / file.length : 0;
        const wanted = stat?.wanted ?? true;
        const priority = stat?.priority ?? 0;

        return (
          <div key={i} className="flex items-center gap-2 px-1 py-0.5 hover:bg-accent">
            <input
              type="checkbox"
              checked={wanted}
              onChange={(e) => toggleWanted(i, e.target.checked)}
              className="w-4"
            />
            <span className="flex-1 truncate">{file.name}</span>
            <span className="w-20 text-right text-muted-foreground">{formatBytes(file.length)}</span>
            <span className="w-16 text-right">{formatPercent(progress)}</span>
            <select
              className="w-16 text-xs bg-background border rounded px-1"
              value={priority}
              onChange={(e) => setPriority(i, Number(e.target.value))}
            >
              <option value={-1}>Low</option>
              <option value={0}>Normal</option>
              <option value={1}>High</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}
