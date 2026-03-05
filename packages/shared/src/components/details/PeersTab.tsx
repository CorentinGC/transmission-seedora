import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Torrent, TorrentPeer } from '../../types/torrent';
import { formatSpeed, formatPercent } from '../../lib/format';
import { useApi } from '../../platform/api-context';

interface Props {
  torrent: Torrent;
}

function countryToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const offset = 0x1f1e6;
  return String.fromCodePoint(
    countryCode.charCodeAt(0) - 65 + offset,
    countryCode.charCodeAt(1) - 65 + offset,
  );
}

type GeoInfo = { country: string; region: string; city: string } | null;

export function PeersTab({ torrent }: Props) {
  const { t } = useTranslation();
  const [peers, setPeers] = useState<TorrentPeer[]>([]);
  const [geoData, setGeoData] = useState<Record<string, GeoInfo>>({});
  const api = useApi();

  useEffect(() => {
    let cancelled = false;
    api
      .rpcTorrentGet(['peers'], [torrent.id])
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          const d = res.data as { torrents: { peers: TorrentPeer[] }[] };
          const peerList = d.torrents?.[0]?.peers ?? [];
          setPeers(peerList);

          // GeoIP lookup
          const ips = peerList.map((p) => p.address);
          if (ips.length > 0 && api.geoipLookup) {
            api.geoipLookup(ips).then((geoRes) => {
              if (!cancelled && geoRes.success && geoRes.data) {
                setGeoData(geoRes.data);
              }
            });
          }
        }
      });
    return () => { cancelled = true; };
  }, [torrent.id, api]);

  if (peers.length === 0) {
    return <div className="text-muted-foreground text-xs">{t('details.noPeers')}</div>;
  }

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2 px-1 py-1 font-medium text-muted-foreground border-b">
        <span className="w-8"></span>
        <span className="w-36">{t('peersTab.address')}</span>
        <span className="w-32">{t('peersTab.client')}</span>
        <span className="w-12">{t('peersTab.flags')}</span>
        <span className="w-14 text-right">{t('peersTab.progress')}</span>
        <span className="w-20 text-right">{t('peersTab.down')}</span>
        <span className="w-20 text-right">{t('peersTab.up')}</span>
      </div>
      {peers.map((peer, i) => {
        const geo = geoData[peer.address];
        const flag = geo ? countryToFlag(geo.country) : '';
        const tooltip = geo ? `${geo.city ? geo.city + ', ' : ''}${geo.country}` : '';
        return (
          <div key={i} className="flex items-center gap-2 px-1 py-0.5 hover:bg-accent">
            <span className="w-8 text-center" title={tooltip}>{flag}</span>
            <span className="w-36 truncate">{peer.address}:{peer.port}</span>
            <span className="w-32 truncate">{peer.clientName}</span>
            <span className="w-12">{peer.flagStr}</span>
            <span className="w-14 text-right">{formatPercent(peer.progress)}</span>
            <span className="w-20 text-right">{formatSpeed(peer.rateToClient)}</span>
            <span className="w-20 text-right">{formatSpeed(peer.rateToPeer)}</span>
          </div>
        );
      })}
    </div>
  );
}
