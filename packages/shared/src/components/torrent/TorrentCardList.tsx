import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Torrent } from '../../types/torrent';
import { formatBytes, formatEta, formatPercent, formatSpeed } from '../../lib/format';
import { getStatusLabelKey } from '../../lib/constants';
import { FOCUS_FALLBACK_ATTRIBUTE } from '../ui/popup';
import { useGridNavigation } from './useGridNavigation';
import { TorrentSortBar } from './TorrentSortBar';
import { menuAnchor, progressWidthPercent } from './card-model';

interface Props {
  /** Torrents in display (sorted) order. */
  torrents: Torrent[];
  selectedIds: Set<number>;
  onRowClick: (id: number, e: React.MouseEvent) => void;
  select: (id: number) => void;
  toggle: (id: number) => void;
  extendTo: (id: number) => void;
  /** Opens the context menu for a torrent at viewport coordinates (pointer or keyboard). */
  onMenu: (id: number, x: number, y: number) => void;
}

/**
 * Compact torrent list for narrow screens: one card per torrent instead of a wide table.
 * Same keyboard model as the grid (focus on the list, `aria-activedescendant` on the active card).
 */
export function TorrentCardList({ torrents, selectedIds, onRowClick, select, toggle, extendTo, onMenu }: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const cardDomId = (id: number) => `${listId}-c${id}`;
  const ids = torrents.map((tor) => tor.id);

  const virtualizer = useVirtualizer({
    count: torrents.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 92,
    overscan: 6,
  });

  const nav = useGridNavigation({
    rowIds: ids,
    selectedIds,
    select,
    toggle,
    extendTo,
    scrollToIndex: (index) => virtualizer.scrollToIndex(index),
    openMenu: (id) => {
      const anchor = menuAnchor(document.getElementById(cardDomId(id))?.getBoundingClientRect());
      onMenu(id, anchor.x, anchor.y);
    },
  });

  const items = virtualizer.getVirtualItems();
  const activeRendered = nav.activeId !== null && items.some((v) => torrents[v.index]?.id === nav.activeId);
  const activeDescendant = nav.focused && nav.activeId !== null && activeRendered ? cardDomId(nav.activeId) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TorrentSortBar />
      <div
        ref={listRef}
        role="listbox"
        aria-label={t('app.torrentList')}
        aria-multiselectable="true"
        aria-activedescendant={activeDescendant}
        {...{ [FOCUS_FALLBACK_ATTRIBUTE]: '' }}
        tabIndex={0}
        onKeyDown={nav.onKeyDown}
        onFocus={nav.onFocus}
        onBlur={nav.onBlur}
        className="min-h-0 flex-1 overflow-y-auto select-none focus:outline-none"
      >
        <div role="presentation" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {items.map((virtualRow) => {
            const torrent = torrents[virtualRow.index];
            if (!torrent) return null;
            const selected = selectedIds.has(torrent.id);
            const active = nav.focused && nav.activeId === torrent.id;
            return (
              // Pointer shortcuts only: the list owns keyboard focus and handles every key (useGridNavigation).
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
              <div
                key={torrent.id}
                id={cardDomId(torrent.id)}
                role="option"
                aria-selected={selected}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={`absolute left-0 w-full border-b border-border/50 px-3 py-2 text-xs cursor-default ${
                  selected ? 'bg-primary/10' : 'active:bg-accent/50'
                } ${active ? 'outline-2 -outline-offset-2 outline-ring' : ''} ${torrent.error > 0 ? 'text-destructive-text' : ''}`}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                onClick={(e) => {
                  nav.setActiveId(torrent.id);
                  onRowClick(torrent.id, e);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onMenu(torrent.id, e.clientX, e.clientY);
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{torrent.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {t(getStatusLabelKey(torrent.status, torrent.error))}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-info transition-all"
                      style={{ width: `${progressWidthPercent(torrent.percentDone)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right">{formatPercent(torrent.percentDone)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    <ArrowDown size={12} aria-hidden="true" />
                    <span className="sr-only">{t('torrent.downSpeed')}</span>
                    {formatSpeed(torrent.rateDownload)}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <ArrowUp size={12} aria-hidden="true" />
                    <span className="sr-only">{t('torrent.upSpeed')}</span>
                    {formatSpeed(torrent.rateUpload)}
                  </span>
                  <span>
                    <span className="sr-only">{t('torrent.eta')} </span>
                    {formatEta(torrent.eta)}
                  </span>
                  <span className="ml-auto">
                    <span className="sr-only">{t('torrent.size')} </span>
                    {formatBytes(torrent.totalSize)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {torrents.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('app.noTorrents')}
          </div>
        )}
      </div>
    </div>
  );
}
