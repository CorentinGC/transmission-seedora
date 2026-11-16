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

/** Sortable columns offered by the compact sort control: column id -> i18n key of its header. */
export const SORT_FIELDS: Record<string, string> = {
  name: 'torrent.name',
  addedDate: 'torrent.added',
  percentDone: 'torrent.done',
  totalSize: 'torrent.size',
  rateDownload: 'torrent.downSpeed',
  rateUpload: 'torrent.upSpeed',
  eta: 'torrent.eta',
  uploadRatio: 'torrent.ratio',
  queuePosition: 'torrent.queuePosition',
};

type Sorting = { id: string; desc: boolean }[];

/** Sort on `id`, keeping the current direction (descending when nothing was sorted yet). */
export function sortByField(sorting: Sorting, id: string): Sorting {
  return [{ id, desc: sorting[0]?.desc ?? true }];
}

/** Flip the direction of the current sort; no-op when nothing is sorted. */
export function toggleSortDirection(sorting: Sorting): Sorting {
  const first = sorting[0];
  return first ? [{ id: first.id, desc: !first.desc }] : sorting;
}
