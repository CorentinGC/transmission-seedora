import { TorrentStatus } from '../types/torrent';

export const STATUS_LABELS: Record<number, string> = {
  [TorrentStatus.STOPPED]: 'Stopped',
  [TorrentStatus.CHECK_WAIT]: 'Queued for verification',
  [TorrentStatus.CHECK]: 'Verifying',
  [TorrentStatus.DOWNLOAD_WAIT]: 'Queued',
  [TorrentStatus.DOWNLOAD]: 'Downloading',
  [TorrentStatus.SEED_WAIT]: 'Queued for seeding',
  [TorrentStatus.SEED]: 'Seeding',
};

export function getStatusLabel(status: number, error: number): string {
  if (error > 0) return 'Error';
  return STATUS_LABELS[status] ?? 'Unknown';
}

export type StatusFilter = 'all' | 'downloading' | 'seeding' | 'completed' | 'active' | 'inactive' | 'stopped' | 'error' | 'waiting';

export function matchesStatusFilter(
  status: number,
  error: number,
  isFinished: boolean,
  rateDownload: number,
  rateUpload: number,
  filter: StatusFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'downloading':
      return status === TorrentStatus.DOWNLOAD;
    case 'seeding':
      return status === TorrentStatus.SEED;
    case 'completed':
      return isFinished || status === TorrentStatus.SEED || status === TorrentStatus.SEED_WAIT;
    case 'active':
      return rateDownload > 0 || rateUpload > 0;
    case 'inactive':
      return rateDownload === 0 && rateUpload === 0 && status !== TorrentStatus.STOPPED;
    case 'stopped':
      return status === TorrentStatus.STOPPED;
    case 'error':
      return error > 0;
    case 'waiting':
      return status === TorrentStatus.DOWNLOAD_WAIT || status === TorrentStatus.SEED_WAIT || status === TorrentStatus.CHECK_WAIT;
    default:
      return true;
  }
}
