import { useMemo, useCallback, useRef, useEffect } from 'react';
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

  return { containerRef, onMouseDown };
}

export function AppShell() {
  const filterPanelVisible = useUiStore((s) => s.filterPanelVisible);
  const detailsPanelVisible = useUiStore((s) => s.detailsPanelVisible);
  const filterPanelSize = useUiStore((s) => s.filterPanelSize);
  const detailsPanelSize = useUiStore((s) => s.detailsPanelSize);
  const setFilterPanelSize = useUiStore((s) => s.setFilterPanelSize);
  const setDetailsPanelSize = useUiStore((s) => s.setDetailsPanelSize);

  useTorrents(3000);
  useSessionStats(5000);

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

  const sidebar = useResizable('horizontal', filterPanelSize, setFilterPanelSize, 120, 400);
  const details = useResizable('vertical', detailsPanelSize, setDetailsPanelSize, 100, 500);

  return (
    <div className="flex flex-col h-screen">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {filterPanelVisible && (
          <>
            <div
              ref={sidebar.containerRef}
              style={{ width: filterPanelSize }}
              className="flex-shrink-0 overflow-hidden"
            >
              <FilterSidebar torrents={Array.from(torrents.values())} />
            </div>
            <div
              className="w-1 cursor-col-resize bg-border hover:bg-primary/30 flex-shrink-0"
              onMouseDown={sidebar.onMouseDown}
            />
          </>
        )}
        <div className="flex flex-col flex-1 overflow-hidden">
          <TorrentTable torrents={filteredTorrents} />
          {detailsPanelVisible && (
            <>
              <div
                className="h-1 cursor-row-resize bg-border hover:bg-primary/30 flex-shrink-0"
                onMouseDown={details.onMouseDown}
              />
              {selectedTorrent ? (
                <div
                  ref={details.containerRef}
                  style={{ height: detailsPanelSize }}
                  className="flex-shrink-0 overflow-hidden"
                >
                  <DetailsPanel torrent={selectedTorrent} />
                </div>
              ) : (
                <div
                  ref={details.containerRef}
                  style={{ height: detailsPanelSize }}
                  className="flex items-center justify-center flex-shrink-0 bg-card text-muted-foreground text-sm"
                >
                  Select a torrent to view details
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
