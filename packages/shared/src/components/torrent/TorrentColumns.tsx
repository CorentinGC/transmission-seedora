import { createColumnHelper } from '@tanstack/react-table';
import type { Torrent } from '../../types/torrent';
import { formatBytes, formatSpeed, formatEta, formatPercent, formatRatio, formatDate, formatDuration } from '../../lib/format';
import { getStatusLabelKey } from '../../lib/constants';

const col = createColumnHelper<Torrent>();

export function createTorrentColumns(relativeDates: boolean, t: (key: string) => string) {
  return [
  col.accessor('queuePosition', {
    header: t('torrent.queuePosition'),
    size: 40,
    minSize: 30,
  }),
  col.accessor('name', {
    header: t('torrent.name'),
    size: 300,
    minSize: 120,
  }),
  col.accessor('totalSize', {
    header: t('torrent.size'),
    size: 80,
    minSize: 60,
    cell: (info) => formatBytes(info.getValue()),
  }),
  col.accessor('percentDone', {
    header: t('torrent.done'),
    size: 90,
    minSize: 60,
    cell: (info) => {
      const val = info.getValue();
      return (
        <div className="flex items-center gap-1">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${val * 100}%` }}
            />
          </div>
          <span className="text-xs w-10 text-right">{formatPercent(val)}</span>
        </div>
      );
    },
  }),
  col.display({
    id: 'statusText',
    header: t('torrent.status'),
    size: 90,
    cell: (info) => t(getStatusLabelKey(info.row.original.status, info.row.original.error)),
  }),
  col.accessor('peersSendingToUs', {
    header: t('torrent.seeds'),
    size: 55,
    minSize: 40,
  }),
  col.accessor('peersGettingFromUs', {
    header: t('torrent.peers'),
    size: 55,
    minSize: 40,
  }),
  col.accessor('rateDownload', {
    header: t('torrent.downSpeed'),
    size: 80,
    minSize: 60,
    cell: (info) => formatSpeed(info.getValue()),
  }),
  col.accessor('rateUpload', {
    header: t('torrent.upSpeed'),
    size: 80,
    minSize: 60,
    cell: (info) => formatSpeed(info.getValue()),
  }),
  col.accessor('eta', {
    header: t('torrent.eta'),
    size: 80,
    minSize: 50,
    cell: (info) => formatEta(info.getValue()),
  }),
  col.accessor('uploadRatio', {
    header: t('torrent.ratio'),
    size: 60,
    minSize: 45,
    cell: (info) => formatRatio(info.getValue()),
  }),
  col.accessor('downloadedEver', {
    header: t('torrent.downloaded'),
    size: 85,
    minSize: 60,
    cell: (info) => formatBytes(info.getValue()),
  }),
  col.accessor('uploadedEver', {
    header: t('torrent.uploaded'),
    size: 85,
    minSize: 60,
    cell: (info) => formatBytes(info.getValue()),
  }),
  col.accessor('addedDate', {
    header: t('torrent.added'),
    size: 130,
    minSize: 80,
    cell: (info) => formatDate(info.getValue(), relativeDates),
  }),
  col.accessor('doneDate', {
    header: t('torrent.completed'),
    size: 130,
    minSize: 80,
    cell: (info) => formatDate(info.getValue(), relativeDates),
  }),
  col.accessor('activityDate', {
    header: t('torrent.lastActive'),
    size: 130,
    minSize: 80,
    cell: (info) => formatDate(info.getValue(), relativeDates),
  }),
  col.accessor('downloadDir', {
    header: t('torrent.path'),
    size: 150,
    minSize: 80,
  }),
  col.display({
    id: 'labels',
    header: t('torrent.labels'),
    size: 100,
    minSize: 60,
    cell: (info) => info.row.original.labels?.join(', ') ?? '',
  }),
  col.display({
    id: 'tracker',
    header: t('torrent.tracker'),
    size: 120,
    minSize: 60,
    cell: (info) => info.row.original.trackerStats?.[0]?.sitename ?? '',
  }),
  col.accessor('bandwidthPriority', {
    header: t('torrent.priority'),
    size: 70,
    minSize: 50,
    cell: (info) => {
      const v = info.getValue();
      return v === 1 ? t('priority.high') : v === -1 ? t('priority.low') : t('priority.normal');
    },
  }),
  col.accessor('isPrivate', {
    header: t('torrent.private'),
    size: 60,
    minSize: 45,
    cell: (info) => (info.getValue() ? t('app.yes') : t('app.no')),
  }),
  col.accessor('id', {
    header: t('torrent.id'),
    size: 55,
    minSize: 40,
  }),
  col.accessor('sizeWhenDone', {
    header: t('torrent.sizeToDownload'),
    size: 85,
    minSize: 60,
    cell: (info) => formatBytes(info.getValue()),
  }),
  col.accessor('leftUntilDone', {
    header: t('torrent.sizeLeft'),
    size: 85,
    minSize: 60,
    cell: (info) => formatBytes(info.getValue()),
  }),
  col.accessor('peersConnected', {
    header: t('torrent.connectedPeers'),
    size: 55,
    minSize: 40,
  }),
  col.accessor('secondsSeeding', {
    header: t('torrent.seedingTime'),
    size: 90,
    minSize: 60,
    cell: (info) => formatDuration(info.getValue()),
  }),
  col.accessor('secondsDownloading', {
    header: t('torrent.downloadingTime'),
    size: 90,
    minSize: 60,
    cell: (info) => formatDuration(info.getValue()),
  }),
  col.accessor('dateCreated', {
    header: t('torrent.created'),
    size: 130,
    minSize: 80,
    cell: (info) => formatDate(info.getValue(), relativeDates),
  }),
  col.accessor('comment', {
    header: t('torrent.comment'),
    size: 150,
    minSize: 80,
  }),
  col.accessor('fileCount', {
    header: t('torrent.fileCount'),
    size: 55,
    minSize: 40,
  }),
  col.accessor('group', {
    header: t('torrent.group'),
    size: 80,
    minSize: 50,
  }),
  ];
}

// Default visible columns
export const DEFAULT_VISIBLE_COLUMNS: Record<string, boolean> = {
  queuePosition: true,
  name: true,
  totalSize: true,
  percentDone: true,
  statusText: true,
  peersSendingToUs: true,
  peersGettingFromUs: true,
  rateDownload: true,
  rateUpload: true,
  eta: true,
  uploadRatio: true,
  downloadedEver: false,
  uploadedEver: false,
  addedDate: true,
  doneDate: false,
  activityDate: false,
  downloadDir: false,
  labels: false,
  tracker: false,
  bandwidthPriority: false,
  isPrivate: false,
  id: false,
  sizeWhenDone: false,
  leftUntilDone: false,
  peersConnected: false,
  secondsSeeding: false,
  secondsDownloading: false,
  dateCreated: false,
  comment: false,
  fileCount: false,
  group: false,
};
