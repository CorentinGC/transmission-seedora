import type { Torrent } from '../../types/torrent';
import { formatBytes, formatSpeed, formatRatio, formatDate, formatEta } from '../../lib/format';
import { getStatusLabel } from '../../lib/constants';
import { useUiStore } from '../../stores/ui-store';

interface Props {
  torrent: Torrent;
}

export function GeneralTab({ torrent: t }: Props) {
  const relativeDates = useUiStore((s) => s.relativeDates);
  const copyMagnet = () => {
    navigator.clipboard.writeText(t.magnetLink);
  };

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
      <InfoRow label="Name" value={t.name} />
      <InfoRow label="Status" value={getStatusLabel(t.status, t.error)} />
      <InfoRow label="Hash" value={t.hashString} />
      <InfoRow label="Size" value={formatBytes(t.totalSize)} />
      <InfoRow label="Downloaded" value={formatBytes(t.downloadedEver)} />
      <InfoRow label="Uploaded" value={formatBytes(t.uploadedEver)} />
      <InfoRow label="Ratio" value={formatRatio(t.uploadRatio)} />
      <InfoRow label="Wasted" value={formatBytes(t.corruptEver)} />
      <InfoRow label="Download Speed" value={formatSpeed(t.rateDownload)} />
      <InfoRow label="Upload Speed" value={formatSpeed(t.rateUpload)} />
      <InfoRow label="ETA" value={formatEta(t.eta)} />
      <InfoRow label="Seeds" value={`${t.peersSendingToUs} connected`} />
      <InfoRow label="Peers" value={`${t.peersGettingFromUs} connected`} />
      <InfoRow label="Location" value={t.downloadDir} />
      <InfoRow label="Added" value={formatDate(t.addedDate, relativeDates)} />
      <InfoRow label="Completed" value={formatDate(t.doneDate, relativeDates)} />
      <InfoRow label="Last Active" value={formatDate(t.activityDate, relativeDates)} />
      <InfoRow label="Created" value={formatDate(t.dateCreated, relativeDates)} />
      <InfoRow label="Pieces" value={`${t.pieceCount} x ${formatBytes(t.pieceSize)}`} />
      <InfoRow label="Comment" value={t.comment} />
      <InfoRow label="Creator" value={t.creator} />
      {t.errorString && (
        <InfoRow label="Error" value={t.errorString} className="text-red-500" />
      )}
      <div className="col-span-2 mt-2">
        <button
          className="text-xs text-blue-500 hover:underline"
          onClick={copyMagnet}
        >
          Copy Magnet Link
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
