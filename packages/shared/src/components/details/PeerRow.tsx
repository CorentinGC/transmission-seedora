import type { CSSProperties } from 'react';
import type { TorrentPeer } from '../../types/torrent';
import { formatSpeed, formatPercent } from '../../lib/format';

/** Country, region and city of a peer address, or null when the lookup found nothing. */
export type GeoInfo = { country: string; region: string; city: string } | null;

/** Height in px of one peer row; the list is virtualised on this fixed size. */
export const PEER_ROW_HEIGHT = 24;

function countryToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const offset = 0x1f1e6;
  return String.fromCodePoint(
    countryCode.charCodeAt(0) - 65 + offset,
    countryCode.charCodeAt(1) - 65 + offset,
  );
}

interface Props {
  peer: TorrentPeer;
  geo: GeoInfo | undefined;
  /** 1-based position in the full list, for assistive technology while rows are virtualised. */
  rowIndex: number;
  style: CSSProperties;
}

/** One row of the peer table. */
export function PeerRow({ peer, geo, rowIndex, style }: Props) {
  const flag = geo ? countryToFlag(geo.country) : '';
  const tooltip = geo ? `${geo.city ? geo.city + ', ' : ''}${geo.country}` : '';
  return (
    <div role="row" aria-rowindex={rowIndex} style={style} className="absolute left-0 top-0 flex w-full items-center gap-2 px-1 hover:bg-accent">
      <span role="cell" className="w-8 text-center" title={tooltip}>{flag}</span>
      <span role="cell" className="w-36 truncate">{peer.address}:{peer.port}</span>
      <span role="cell" className="w-32 truncate">{peer.clientName}</span>
      <span role="cell" className="w-12">{peer.flagStr}</span>
      <span role="cell" className="w-14 text-right">{formatPercent(peer.progress)}</span>
      <span role="cell" className="w-20 text-right">{formatSpeed(peer.rateToClient)}</span>
      <span role="cell" className="w-20 text-right">{formatSpeed(peer.rateToPeer)}</span>
    </div>
  );
}
