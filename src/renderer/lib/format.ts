const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const SPEED_UNITS = ['B/s', 'KB/s', 'MB/s', 'GB/s'];

export function formatBytes(bytes: number): string {
  if (bytes == null || isNaN(bytes)) return '';
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const index = Math.min(i, BYTE_UNITS.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${BYTE_UNITS[index]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond == null || isNaN(bytesPerSecond)) return '';
  if (bytesPerSecond <= 0) return '0 B/s';
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
  const index = Math.min(i, SPEED_UNITS.length - 1);
  return `${(bytesPerSecond / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${SPEED_UNITS[index]}`;
}

export function formatEta(seconds: number): string {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '';
  if (seconds === 0) return 'Done';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function formatDuration(seconds: number): string {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return '';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatRatio(ratio: number): string {
  if (ratio == null || isNaN(ratio) || ratio < 0) return '';
  return ratio.toFixed(2);
}

export function formatDate(timestamp: number, relative = false): string {
  if (timestamp == null || timestamp <= 0) return '—';
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return '—';

  if (relative) {
    return formatRelativeDate(date);
  }

  return date.toLocaleString();
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
