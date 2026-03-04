import { useMemo } from 'react';
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

export function AppShell() {
  const filterPanelVisible = useUiStore((s) => s.filterPanelVisible);
  const detailsPanelVisible = useUiStore((s) => s.detailsPanelVisible);

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

  return (
    <div className="flex flex-col h-screen">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {filterPanelVisible && (
          <FilterSidebar torrents={Array.from(torrents.values())} />
        )}
        <div className="flex flex-col flex-1 overflow-hidden">
          <TorrentTable torrents={filteredTorrents} />
          {detailsPanelVisible && selectedTorrent && (
            <DetailsPanel torrent={selectedTorrent} />
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
