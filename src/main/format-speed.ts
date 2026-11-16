import { t } from './i18n/main-i18n';

/** Formats a byte rate for the tray menu and tooltip; unit templates come from `native.tray.units.*`. */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return t('native.tray.units.bytesPerSecond', { value: bytesPerSecond });
  if (bytesPerSecond < 1024 * 1024) {
    return t('native.tray.units.kilobytesPerSecond', { value: (bytesPerSecond / 1024).toFixed(1) });
  }
  return t('native.tray.units.megabytesPerSecond', { value: (bytesPerSecond / (1024 * 1024)).toFixed(1) });
}
