import i18n from 'i18next';

const BYTE_UNIT_KEYS = ['b', 'kb', 'mb', 'gb', 'tb', 'pb'] as const;
const BYTE_UNIT_FALLBACKS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const SPEED_UNIT_COUNT = 4;
const DURATION_FALLBACKS = { days: '{{n}}d', hours: '{{n}}h', minutes: '{{n}}m', seconds: '{{n}}s' } as const;

/** Replaces `{{name}}` placeholders; used when i18next is not initialised (unit tests, early boot). */
function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(values[name] ?? ''));
}

/** Translates a `format.*` key for the active language, falling back to English text before i18next is ready. */
function translate(key: string, fallback: string, values: Record<string, string | number> = {}): string {
  if (!i18n.isInitialized) return interpolate(fallback, values);
  return i18n.t(key, { defaultValue: fallback, ...values });
}

/** BCP 47 tag of the active UI language, for `Intl` formatters. */
function activeLocale(): string {
  return i18n.isInitialized && i18n.language ? i18n.language : 'en';
}

function byteUnit(index: number): string {
  return translate(`format.unit.${BYTE_UNIT_KEYS[index]}`, BYTE_UNIT_FALLBACKS[index] ?? '');
}

function duration(unit: keyof typeof DURATION_FALLBACKS, n: number): string {
  return translate(`format.duration.${unit}`, DURATION_FALLBACKS[unit], { n });
}

/** Formats a byte count with a localised unit (1024-based). */
export function formatBytes(bytes: number): string {
  if (bytes == null || isNaN(bytes)) return '';
  if (bytes === 0) return `0 ${byteUnit(0)}`;
  if (bytes < 0) return '';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const index = Math.min(i, BYTE_UNIT_KEYS.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${byteUnit(index)}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond == null || isNaN(bytesPerSecond)) return '';
  const perSecond = (size: string) => translate('format.perSecond', '{{size}}/s', { size });
  if (bytesPerSecond <= 0) return perSecond(`0 ${byteUnit(0)}`);
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
  const index = Math.min(i, SPEED_UNIT_COUNT - 1);
  return perSecond(`${(bytesPerSecond / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${byteUnit(index)}`);
}

export function formatEta(seconds: number): string {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '';
  if (seconds === 0) return translate('format.done', 'Done');

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${duration('days', days)} ${duration('hours', hours)}`;
  if (hours > 0) return `${duration('hours', hours)} ${duration('minutes', minutes)}`;
  if (minutes > 0) return `${duration('minutes', minutes)} ${duration('seconds', secs)}`;
  return duration('seconds', secs);
}

export function formatDuration(seconds: number): string {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return '';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${duration('days', days)} ${duration('hours', hours)}`;
  if (hours > 0) return `${duration('hours', hours)} ${duration('minutes', minutes)}`;
  return duration('minutes', minutes);
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

  return date.toLocaleString(activeLocale());
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return translate('format.justNow', 'Just now');
  const rtf = new Intl.RelativeTimeFormat(activeLocale(), { numeric: 'always', style: 'short' });
  if (diffMins < 60) return rtf.format(-diffMins, 'minute');
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  if (diffDays < 30) return rtf.format(-diffDays, 'day');
  return date.toLocaleDateString(activeLocale());
}
