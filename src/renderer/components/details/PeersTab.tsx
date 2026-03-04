import { useEffect, useState } from 'react';
import type { Torrent, TorrentPeer } from '../../types/torrent';
import { formatSpeed, formatPercent } from '../../lib/format';

interface Props {
  torrent: Torrent;
}

export function PeersTab({ torrent }: Props) {
  const [peers, setPeers] = useState<TorrentPeer[]>([]);

  useEffect(() => {
    let cancelled = false;
    window.api
      .rpcTorrentGet(['peers'], [torrent.id])
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          const d = res.data as { torrents: { peers: TorrentPeer[] }[] };
          if (d.torrents?.[0]?.peers) setPeers(d.torrents[0].peers);
        }
      });
    return () => { cancelled = true; };
  }, [torrent.id]);

  if (peers.length === 0) {
    return <div className="text-muted-foreground text-xs">No peers connected</div>;
  }

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2 px-1 py-1 font-medium text-muted-foreground border-b">
        <span className="w-36">Address</span>
        <span className="w-32">Client</span>
        <span className="w-12">Flags</span>
        <span className="w-14 text-right">Progress</span>
        <span className="w-20 text-right">Down</span>
        <span className="w-20 text-right">Up</span>
      </div>
      {peers.map((peer, i) => (
        <div key={i} className="flex items-center gap-2 px-1 py-0.5 hover:bg-accent">
          <span className="w-36 truncate">{peer.address}:{peer.port}</span>
          <span className="w-32 truncate">{peer.clientName}</span>
          <span className="w-12">{peer.flagStr}</span>
          <span className="w-14 text-right">{formatPercent(peer.progress)}</span>
          <span className="w-20 text-right">{formatSpeed(peer.rateToClient)}</span>
          <span className="w-20 text-right">{formatSpeed(peer.rateToPeer)}</span>
        </div>
      ))}
    </div>
  );
}
