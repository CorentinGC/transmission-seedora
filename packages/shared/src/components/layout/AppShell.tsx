import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { FilterSidebar } from '../filter/FilterSidebar';
import { TorrentTable } from '../torrent/TorrentTable';
import { DetailsPanel } from '../details/DetailsPanel';
import { useUiStore } from '../../stores/ui-store';
import { useTorrents } from '../../hooks/useTorrents';
import { useSessionStats } from '../../hooks/useSessionStats';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useTorrentStore } from '../../stores/torrent-store';
import { matchesStatusFilter } from '../../lib/constants';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Toaster, Sheet } from '../ui';

const KEYBOARD_STEP = 16;

function useResizable(
  direction: 'horizontal' | 'vertical',
  initialSize: number,
  onSizeChange?: (size: number) => void,
  minSize = 100,
  maxSize = 600,
) {
  const sizeRef = useRef(initialSize);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sizeRef.current = initialSize;
  }, [initialSize]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const startSize = sizeRef.current;

      const onMouseMove = (ev: MouseEvent) => {
        const currentPos = direction === 'horizontal' ? ev.clientX : ev.clientY;
        const diff = direction === 'vertical' ? startPos - currentPos : currentPos - startPos;
        const newSize = Math.max(minSize, Math.min(maxSize, startSize + diff));
        sizeRef.current = newSize;
        if (containerRef.current) {
          if (direction === 'horizontal') {
            containerRef.current.style.width = `${newSize}px`;
          } else {
            containerRef.current.style.height = `${newSize}px`;
          }
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onSizeChange?.(sizeRef.current);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, minSize, maxSize, onSizeChange],
  );

  /** Arrow keys resize the pane by 16px: Left/Right for a sidebar, Up/Down for a bottom pane. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const grow = direction === 'horizontal' ? 'ArrowRight' : 'ArrowUp';
      const shrink = direction === 'horizontal' ? 'ArrowLeft' : 'ArrowDown';
      if (e.key !== grow && e.key !== shrink) return;
      e.preventDefault();
      e.stopPropagation();
      const next = Math.max(minSize, Math.min(maxSize, sizeRef.current + (e.key === grow ? KEYBOARD_STEP : -KEYBOARD_STEP)));
      sizeRef.current = next;
      onSizeChange?.(next);
    },
    [direction, minSize, maxSize, onSizeChange],
  );

  return { containerRef, onMouseDown, onKeyDown };
}

export function AppShell() {
  const { t } = useTranslation();
  const filterPanelVisible = useUiStore((s) => s.filterPanelVisible);
  const detailsPanelVisible = useUiStore((s) => s.detailsPanelVisible);
  const filterPanelSize = useUiStore((s) => s.filterPanelSize);
  const detailsPanelSize = useUiStore((s) => s.detailsPanelSize);
  const setFilterPanelSize = useUiStore((s) => s.setFilterPanelSize);
  const setDetailsPanelSize = useUiStore((s) => s.setDetailsPanelSize);

  const pollingInterval = useUiStore((s) => s.pollingInterval);
  useTorrents(pollingInterval);
  useSessionStats(pollingInterval + 2000);

  const torrents = useTorrentStore((s) => s.torrents);
  const globalFilter = useTorrentStore((s) => s.globalFilter);
  const statusFilter = useTorrentStore((s) => s.statusFilter);
  const labelFilter = useTorrentStore((s) => s.labelFilter);
  const trackerFilter = useTorrentStore((s) => s.trackerFilter);
  const folderFilter = useTorrentStore((s) => s.folderFilter);

  const filteredTorrents = useMemo(() => {
    let result = Array.from(torrents.values());

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((t) =>
        matchesStatusFilter(t.status, t.error, t.isFinished, t.rateDownload, t.rateUpload, statusFilter),
      );
    }

    // Label filter
    if (labelFilter) {
      result = result.filter((t) => t.labels?.includes(labelFilter));
    }

    // Tracker filter
    if (trackerFilter) {
      result = result.filter((t) =>
        t.trackerStats?.some((ts) => ts.sitename === trackerFilter || ts.host === trackerFilter),
      );
    }

    // Folder filter
    if (folderFilter) {
      result = result.filter((t) => t.downloadDir === folderFilter);
    }

    // Text search
    if (globalFilter) {
      const query = globalFilter.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(query));
    }

    return result;
  }, [torrents, globalFilter, statusFilter, labelFilter, trackerFilter, folderFilter]);

  const allVisibleIds = useMemo(() => filteredTorrents.map((t) => t.id), [filteredTorrents]);
  useKeyboardShortcuts(allVisibleIds);

  const selectedTorrent = useTorrentStore((s) => {
    if (s.selectedIds.size !== 1) return null;
    const id = Array.from(s.selectedIds)[0];
    return s.torrents.get(id) ?? null;
  });

  const sidebar = useResizable('horizontal', filterPanelSize, setFilterPanelSize, 80, 400);
  const details = useResizable('vertical', detailsPanelSize, setDetailsPanelSize, 100, 500);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobilePanel, setMobilePanel] = useState<'filters' | 'details' | null>(null);
  const toggleFilterPanel = useUiStore((s) => s.toggleFilterPanel);
  const toggleDetailsPanel = useUiStore((s) => s.toggleDetailsPanel);

  // Leaving the small layout must not leave a sheet open behind the desktop panes.
  useEffect(() => {
    if (isDesktop) setMobilePanel(null);
  }, [isDesktop]);

  const toggleMobile = (panel: 'filters' | 'details') => setMobilePanel((current) => (current === panel ? null : panel));

  const detailsContent = selectedTorrent ? (
    <DetailsPanel torrent={selectedTorrent} />
  ) : (
    <div className="flex h-full items-center justify-center bg-card p-4 text-center text-muted-foreground text-sm">
      {t('app.selectTorrent')}
    </div>
  );

  return (
    <div className="flex flex-col h-dvh">
      <Toolbar
        filterPanelOpen={isDesktop ? filterPanelVisible : mobilePanel === 'filters'}
        detailsPanelOpen={isDesktop ? detailsPanelVisible : mobilePanel === 'details'}
        onToggleFilterPanel={isDesktop ? toggleFilterPanel : () => toggleMobile('filters')}
        onToggleDetailsPanel={isDesktop ? toggleDetailsPanel : () => toggleMobile('details')}
      />
      <div className="flex flex-1 overflow-hidden">
        {isDesktop && filterPanelVisible && (
          <>
            <div
              ref={sidebar.containerRef}
              style={{ width: filterPanelSize }}
              className="flex-shrink-0 overflow-hidden"
            >
              <FilterSidebar torrents={Array.from(torrents.values())} />
            </div>
            {/* A focusable separator is the ARIA window-splitter pattern (arrow keys resize). */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('app.resizePanel')}
              aria-valuenow={filterPanelSize}
              aria-valuemin={80}
              aria-valuemax={400}
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              className="w-1 cursor-col-resize bg-border hover:bg-primary/30 focus-visible:bg-primary/30 flex-shrink-0"
              onMouseDown={sidebar.onMouseDown}
              onKeyDown={sidebar.onKeyDown}
            />
          </>
        )}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TorrentTable torrents={filteredTorrents} />
          {isDesktop && detailsPanelVisible && (
            <>
              {/* A focusable separator is the ARIA window-splitter pattern (arrow keys resize). */}
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label={t('app.resizePanel')}
                aria-valuenow={detailsPanelSize}
                aria-valuemin={100}
                aria-valuemax={500}
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                className="h-1 cursor-row-resize bg-border hover:bg-primary/30 focus-visible:bg-primary/30 flex-shrink-0"
                onMouseDown={details.onMouseDown}
                onKeyDown={details.onKeyDown}
              />
              <div
                ref={details.containerRef}
                style={{ height: detailsPanelSize }}
                className="flex-shrink-0 overflow-hidden"
              >
                {detailsContent}
              </div>
            </>
          )}
        </div>
      </div>
      <StatusBar />
      <Toaster />

      {!isDesktop && mobilePanel === 'filters' && (
        <Sheet side="left" label={t('toolbar.filterPanel')} onClose={() => setMobilePanel(null)}>
          <FilterSidebar torrents={Array.from(torrents.values())} onSelect={() => setMobilePanel(null)} />
        </Sheet>
      )}
      {!isDesktop && mobilePanel === 'details' && (
        <Sheet side="full" label={t('toolbar.detailsPanel')} onClose={() => setMobilePanel(null)}>
          {detailsContent}
        </Sheet>
      )}
    </div>
  );
}
