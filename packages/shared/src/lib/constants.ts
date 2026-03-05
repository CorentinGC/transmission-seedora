import { TorrentStatus } from '../types/torrent';

export const STATUS_LABEL_KEYS: Record<number, string> = {
  [TorrentStatus.STOPPED]: 'status.stopped',
  [TorrentStatus.CHECK_WAIT]: 'status.checkWait',
  [TorrentStatus.CHECK]: 'status.check',
  [TorrentStatus.DOWNLOAD_WAIT]: 'status.downloadWait',
  [TorrentStatus.DOWNLOAD]: 'status.download',
  [TorrentStatus.SEED_WAIT]: 'status.seedWait',
  [TorrentStatus.SEED]: 'status.seed',
};

export function getStatusLabelKey(status: number, error: number): string {
  if (error > 0) return 'status.error';
  return STATUS_LABEL_KEYS[status] ?? 'status.unknown';
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
