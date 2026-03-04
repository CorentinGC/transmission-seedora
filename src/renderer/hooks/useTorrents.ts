import { useCallback, useRef } from 'react';
import { useTorrentStore } from '../stores/torrent-store';
import { useServerStore } from '../stores/server-store';
import { usePolling } from './usePolling';

const FULL_FETCH_INTERVAL = 10; // Every 10th poll, do a full fetch

export function useTorrents(pollingInterval: number) {
  const fetchTorrents = useTorrentStore((s) => s.fetchTorrents);
  const fetchRecentlyActive = useTorrentStore((s) => s.fetchRecentlyActive);
  const reset = useTorrentStore((s) => s.reset);
  const connectionStatus = useServerStore((s) => s.connectionStatus);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const pollCount = useRef(0);
  const prevServerId = useRef<string | null>(null);

  const poll = useCallback(async () => {
    // Reset on server change
    if (activeServerId !== prevServerId.current) {
      prevServerId.current = activeServerId;
      reset();
      if (!activeServerId) return;
      await fetchTorrents();
      pollCount.current = 0;
      return;
    }

    pollCount.current++;
    if (pollCount.current % FULL_FETCH_INTERVAL === 0) {
      await fetchTorrents();
    } else {
      await fetchRecentlyActive();
    }
  }, [activeServerId, fetchTorrents, fetchRecentlyActive, reset]);

  usePolling(poll, pollingInterval, connectionStatus === 'connected');
}
