import type { AppPreferences } from '../types';

/** Smallest polling interval (ms) the main process accepts. */
export const MIN_POLLING_INTERVAL_MS = 250;

/**
 * True when the numeric preferences can be accepted by the main process:
 * a finite polling interval of at least 250 ms and finite, non-negative speed presets.
 */
export function hasValidNumbers(prefs: Pick<AppPreferences, 'pollingInterval' | 'speedPresets'>): boolean {
  if (!Number.isFinite(prefs.pollingInterval) || prefs.pollingInterval < MIN_POLLING_INTERVAL_MS) return false;
  return (prefs.speedPresets ?? []).every((v) => Number.isFinite(v) && v >= 0);
}

/** Parses a numeric input value; an empty or non-numeric string yields NaN, not 0. */
export function parseNumberInput(raw: string): number {
  return raw.trim() === '' ? Number.NaN : Number(raw);
}
