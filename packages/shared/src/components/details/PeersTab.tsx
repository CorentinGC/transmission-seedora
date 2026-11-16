import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Torrent, TorrentPeer } from '../../types/torrent';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useApi } from '../../platform/api-context';
import { useTorrentFields } from '../../hooks/useTorrentFields';
import { PeerRow, PEER_ROW_HEIGHT, type GeoInfo } from './PeerRow';

interface Props {
  torrent: Torrent;
}

const PEER_FIELDS = ['peers'] as const;

export function PeersTab({ torrent }: Props) {
  const { t } = useTranslation();
  const { data, error } = useTorrentFields<{ peers: TorrentPeer[] }>(torrent.id, PEER_FIELDS);
  const [geoData, setGeoData] = useState<Record<string, GeoInfo>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const api = useApi();
  const peers = data?.peers ?? [];
  const addressKey = peers
    .map((p) => p.address)
    .sort()
    .join(',');

  const virtualizer = useVirtualizer({
    count: peers.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => PEER_ROW_HEIGHT,
    overscan: 10,
  });

  useEffect(() => {
    if (!addressKey || !api.geoipLookup) return;
    let cancelled = false;
    api
      .geoipLookup(addressKey.split(','))
      .then((geoRes) => {
        if (!cancelled && geoRes.success && geoRes.data) setGeoData(geoRes.data);
      })
      .catch(() => {
        // GeoIP is a cosmetic enrichment: peers stay listed without flags.
      });
    return () => {
      cancelled = true;
    };
  }, [addressKey, api]);

  if (error && !data) {
    return (
      <div role="alert" className="text-destructive-text text-xs">
        {t('details.loadFailed', { error })}
      </div>
    );
  }

  if (peers.length === 0) {
    return <div className="text-muted-foreground text-xs">{t('details.noPeers')}</div>;
  }

  return (
    <div
      role="table"
      aria-label={t('details.peers')}
      aria-rowcount={peers.length + 1}
      className="flex h-full min-h-0 flex-col text-xs"
    >
      <div role="row" className="flex items-center gap-2 px-1 py-1 font-medium text-muted-foreground border-b">
        <span role="columnheader" className="w-8">
          <span className="sr-only">{t('peersTab.country')}</span>
        </span>
        <span role="columnheader" className="w-36">
          {t('peersTab.address')}
        </span>
        <span role="columnheader" className="w-32">
          {t('peersTab.client')}
        </span>
        <span role="columnheader" className="w-12">
          {t('peersTab.flags')}
        </span>
        <span role="columnheader" className="w-14 text-right">
          {t('peersTab.progress')}
        </span>
        <span role="columnheader" className="w-20 text-right">
          {t('peersTab.down')}
        </span>
        <span role="columnheader" className="w-20 text-right">
          {t('peersTab.up')}
        </span>
      </div>
      {/* Focusable so keyboard users can scroll the list. */}
      <div
        ref={scrollRef}
        role="rowgroup"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-label={t('details.peers')}
        className="min-h-0 flex-1 overflow-auto focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const peer = peers[item.index];
            if (!peer) return null;
            return (
              <PeerRow
                key={`${peer.address}:${peer.port}`}
                peer={peer}
                geo={geoData[peer.address]}
                rowIndex={item.index + 2}
                style={{ height: item.size, transform: `translateY(${item.start}px)` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
