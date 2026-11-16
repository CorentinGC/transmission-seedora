import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';
import { Select } from '../ui';
import { SORT_FIELDS, sortByField, toggleSortDirection } from './card-model';

/** Compact sort control (field select and direction toggle) for the card list, bound to the store sort state. */
export function TorrentSortBar() {
  const { t } = useTranslation();
  const sorting = useTorrentStore((s) => s.sortingState);
  const setSorting = useTorrentStore((s) => s.setSortingState);
  const current = sorting[0];
  const field = current && current.id in SORT_FIELDS ? current.id : '';
  const desc = current?.desc ?? true;
  const toggleLabel = t(desc ? 'torrent.sortAscending' : 'torrent.sortDescending');

  return (
    <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5">
      <Select
        aria-label={t('torrent.sortBy')}
        value={field}
        onChange={(e) => setSorting(sortByField(sorting, e.target.value))}
        className="min-w-0 flex-1 pointer-coarse:h-11"
      >
        {field === '' && (
          <option value="" disabled>
            {t('torrent.sortBy')}
          </option>
        )}
        {Object.entries(SORT_FIELDS).map(([id, key]) => (
          <option key={id} value={id}>
            {t(key)}
          </option>
        ))}
      </Select>
      <button
        type="button"
        aria-label={toggleLabel}
        title={toggleLabel}
        disabled={!current}
        onClick={() => setSorting(toggleSortDirection(sorting))}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11"
      >
        {desc ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}
