import { useCallback } from 'react';
import { useSessionStore } from '../stores/session-store';
import { useServerStore } from '../stores/server-store';
import { notifyFailure } from '../stores/notification-store';
import { usePolling } from './usePolling';

function reportStatsError(error: unknown): void {
  notifyFailure('notification.statsRefreshFailed', error instanceof Error ? error.message : undefined);
}

/**
 * Polls session stats, settings and free space while connected. A failed refresh
 * is reported once per outage with its own message (not the torrent-list one).
 */
export function useSessionStats(pollingInterval: number) {
  const fetchStats = useSessionStore((s) => s.fetchStats);
  const fetchSettings = useSessionStore((s) => s.fetchSettings);
  const fetchFreeSpace = useSessionStore((s) => s.fetchFreeSpace);
  const connectionStatus = useServerStore((s) => s.connectionStatus);

  const poll = useCallback(async () => {
    const failures = (await Promise.all([fetchStats(), fetchSettings()])).filter((e): e is string => e !== null);
    if (failures.length > 0) throw new Error(failures[0]);
    // Fetch free space for the download directory (needs settings loaded first)
    const settings = useSessionStore.getState().settings;
    const downloadDir = settings?.downloadDir;
    if (downloadDir) {
      await fetchFreeSpace(downloadDir);
    }
  }, [fetchStats, fetchSettings, fetchFreeSpace]);

  usePolling(poll, pollingInterval, connectionStatus === 'connected', reportStatsError);
}
