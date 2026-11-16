/** Pure helpers for the compact (card) torrent list; no DOM so they run in the node test environment. */

/** Media query under which the torrent list renders as cards (Tailwind `sm` breakpoint). */
export const COMPACT_LIST_QUERY = '(max-width: 639px)';

/** Progress bar width in percent, clamped to 0-100 and safe against NaN from the daemon. */
export function progressWidthPercent(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(100, Math.max(0, ratio * 100));
}

/** Where to anchor a context menu opened from the keyboard: just under the card, slightly indented. */
export function menuAnchor(rect: { left: number; bottom: number } | undefined): { x: number; y: number } {
  return { x: (rect?.left ?? 0) + 32, y: rect?.bottom ?? 0 };
}
