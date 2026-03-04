import { useTranslation } from 'react-i18next';
import type { Torrent } from '../../types/torrent';
import { formatBytes, formatSpeed, formatRatio, formatDate, formatEta } from '../../lib/format';
import { getStatusLabelKey } from '../../lib/constants';
import { useUiStore } from '../../stores/ui-store';

interface Props {
  torrent: Torrent;
}

export function GeneralTab({ torrent: tor }: Props) {
  const { t } = useTranslation();
  const relativeDates = useUiStore((s) => s.relativeDates);
  const copyMagnet = () => {
    navigator.clipboard.writeText(tor.magnetLink);
  };

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
      <InfoRow label={t('torrent.name')} value={tor.name} />
      <InfoRow label={t('torrent.status')} value={t(getStatusLabelKey(tor.status, tor.error))} />
      <InfoRow label={t('details.hash')} value={tor.hashString} />
      <InfoRow label={t('torrent.size')} value={formatBytes(tor.totalSize)} />
      <InfoRow label={t('torrent.downloaded')} value={formatBytes(tor.downloadedEver)} />
      <InfoRow label={t('torrent.uploaded')} value={formatBytes(tor.uploadedEver)} />
      <InfoRow label={t('torrent.ratio')} value={formatRatio(tor.uploadRatio)} />
      <InfoRow label={t('details.wasted')} value={tor.corruptEver > 0 ? formatBytes(tor.corruptEver) : ''} />
      <InfoRow label={t('details.downloadSpeed')} value={formatSpeed(tor.rateDownload)} />
      <InfoRow label={t('details.uploadSpeed')} value={formatSpeed(tor.rateUpload)} />
      <InfoRow label={t('torrent.eta')} value={formatEta(tor.eta)} />
      <InfoRow label={t('torrent.seeds')} value={`${tor.peersSendingToUs} ${t('details.connected')}`} />
      <InfoRow label={t('torrent.peers')} value={`${tor.peersGettingFromUs} ${t('details.connected')}`} />
      <InfoRow label={t('details.location')} value={tor.downloadDir} />
      <InfoRow label={t('torrent.added')} value={formatDate(tor.addedDate, relativeDates)} />
      <InfoRow label={t('torrent.completed')} value={formatDate(tor.doneDate, relativeDates)} />
      <InfoRow label={t('torrent.lastActive')} value={formatDate(tor.activityDate, relativeDates)} />
      <InfoRow label={t('details.created')} value={formatDate(tor.dateCreated, relativeDates)} />
      <InfoRow label={t('details.pieces')} value={tor.pieceCount > 0 && tor.pieceSize > 0 ? t('details.piecesFormat', { count: tor.pieceCount, size: formatBytes(tor.pieceSize) }) : ''} />
      <InfoRow label={t('details.comment')} value={tor.comment} />
      <InfoRow label={t('details.creator')} value={tor.creator} />
      {tor.errorString && (
        <InfoRow label={t('status.error')} value={tor.errorString} className="text-red-500" />
      )}
      <div className="col-span-2 mt-2">
        <button
          className="text-xs text-blue-500 hover:underline"
          onClick={copyMagnet}
        >
          {t('details.copyMagnet')}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, className }: { label: string; value: string; className?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 flex-shrink-0">{label}:</span>
      <span className={`truncate ${className ?? ''}`}>{value}</span>
    </div>
  );
}
