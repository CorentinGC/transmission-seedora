import { createColumnHelper } from '@tanstack/react-table';
import type { Torrent } from '../../types/torrent';
import { formatBytes, formatSpeed, formatEta, formatPercent, formatRatio, formatDate } from '../../lib/format';
import { getStatusLabel } from '../../lib/constants';

const col = createColumnHelper<Torrent>();

export function createTorrentColumns(relativeDates: boolean) {
  return [
  col.accessor('queuePosition', {
    header: '#',
    size: 40,
    minSize: 30,
  }),
  col.accessor('name', {
    header: 'Name',
    size: 300,
    minSize: 120,
  }),
  col.accessor('totalSize', {
    header: 'Size',
    size: 80,
    minSize: 60,
    cell: (info) => formatBytes(info.getValue()),
  }),
  col.accessor('percentDone', {
    header: 'Done',
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
    header: 'Status',
    size: 90,
    cell: (info) => getStatusLabel(info.row.original.status, info.row.original.error),
  }),
  col.accessor('peersSendingToUs', {
    header: 'Seeds',
    size: 55,
    minSize: 40,
  }),
  col.accessor('peersGettingFromUs', {
    header: 'Peers',
    size: 55,
    minSize: 40,
  }),
  col.accessor('rateDownload', {
    header: 'Down',
    size: 80,
    minSize: 60,
    cell: (info) => formatSpeed(info.getValue()),
  }),
  col.accessor('rateUpload', {
    header: 'Up',
    size: 80,
    minSize: 60,
    cell: (info) => formatSpeed(info.getValue()),
  }),
  col.accessor('eta', {
    header: 'ETA',
    size: 80,
    minSize: 50,
    cell: (info) => formatEta(info.getValue()),
  }),
  col.accessor('uploadRatio', {
    header: 'Ratio',
    size: 60,
    minSize: 45,
    cell: (info) => formatRatio(info.getValue()),
  }),
  col.accessor('downloadedEver', {
    header: 'Downloaded',
    size: 85,
    minSize: 60,
    cell: (info) => formatBytes(info.getValue()),
  }),
  col.accessor('uploadedEver', {
    header: 'Uploaded',
    size: 85,
    minSize: 60,
    cell: (info) => formatBytes(info.getValue()),
  }),
  col.accessor('addedDate', {
    header: 'Added',
    size: 130,
    minSize: 80,
    cell: (info) => formatDate(info.getValue(), relativeDates),
  }),
  col.accessor('doneDate', {
    header: 'Completed',
    size: 130,
    minSize: 80,
    cell: (info) => formatDate(info.getValue(), relativeDates),
  }),
  col.accessor('activityDate', {
    header: 'Last Active',
    size: 130,
    minSize: 80,
    cell: (info) => formatDate(info.getValue(), relativeDates),
  }),
  col.accessor('downloadDir', {
    header: 'Path',
    size: 150,
    minSize: 80,
  }),
  col.display({
    id: 'labels',
    header: 'Labels',
    size: 100,
    minSize: 60,
    cell: (info) => info.row.original.labels?.join(', ') ?? '',
  }),
  col.display({
    id: 'tracker',
    header: 'Tracker',
    size: 120,
    minSize: 60,
    cell: (info) => info.row.original.trackerStats?.[0]?.sitename ?? '',
  }),
  col.accessor('bandwidthPriority', {
    header: 'Priority',
    size: 70,
    minSize: 50,
    cell: (info) => {
      const v = info.getValue();
      return v === 1 ? 'High' : v === -1 ? 'Low' : 'Normal';
    },
  }),
  col.accessor('isPrivate', {
    header: 'Private',
    size: 60,
    minSize: 45,
    cell: (info) => (info.getValue() ? 'Yes' : 'No'),
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
};
