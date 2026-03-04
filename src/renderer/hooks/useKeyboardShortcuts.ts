import { useEffect, useCallback } from 'react';
import { useTorrentStore } from '../stores/torrent-store';

export function useKeyboardShortcuts(allVisibleIds: number[]) {
  const selectedIds = useTorrentStore((s) => s.selectedIds);
  const startTorrents = useTorrentStore((s) => s.startTorrents);
  const stopTorrents = useTorrentStore((s) => s.stopTorrents);
  const selectAll = useTorrentStore((s) => s.selectAll);
  const setGlobalFilter = useTorrentStore((s) => s.setGlobalFilter);
  const setStatusFilter = useTorrentStore((s) => s.setStatusFilter);
  const torrents = useTorrentStore((s) => s.torrents);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // Cmd/Ctrl+F: focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
        searchInput?.focus();
        return;
      }

      // Cmd/Ctrl+A: select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isInput) {
        e.preventDefault();
        selectAll(allVisibleIds);
        return;
      }

      // Don't handle other shortcuts when in input fields
      if (isInput) return;

      const ids = Array.from(selectedIds);

      // Space: toggle start/stop
      if (e.key === ' ' && ids.length > 0) {
        e.preventDefault();
        const firstTorrent = torrents.get(ids[0]);
        if (firstTorrent && firstTorrent.status === 0) {
          startTorrents(ids);
        } else {
          stopTorrents(ids);
        }
        return;
      }

      // Escape: clear search
      if (e.key === 'Escape') {
        setGlobalFilter('');
        (document.activeElement as HTMLElement)?.blur();
        return;
      }

      // Alt+1-8: status filters
      if (e.altKey && e.key >= '1' && e.key <= '8') {
        const filters = ['all', 'downloading', 'seeding', 'completed', 'active', 'inactive', 'stopped', 'error'] as const;
        const index = parseInt(e.key) - 1;
        if (index < filters.length) {
          setStatusFilter(filters[index]);
        }
        return;
      }
    },
    [selectedIds, allVisibleIds, startTorrents, stopTorrents, selectAll, setGlobalFilter, setStatusFilter, torrents],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
