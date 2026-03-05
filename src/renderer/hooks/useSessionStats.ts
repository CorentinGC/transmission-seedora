import { useCallback } from 'react';
import { useSessionStore } from '../stores/session-store';
import { useServerStore } from '../stores/server-store';
import { usePolling } from './usePolling';

export function useSessionStats(pollingInterval: number) {
  const fetchStats = useSessionStore((s) => s.fetchStats);
  const fetchSettings = useSessionStore((s) => s.fetchSettings);
  const fetchFreeSpace = useSessionStore((s) => s.fetchFreeSpace);
  const connectionStatus = useServerStore((s) => s.connectionStatus);

  const poll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchSettings()]);
    // Fetch free space for the download directory (needs settings loaded first)
    const settings = useSessionStore.getState().settings;
    const downloadDir = settings?.downloadDir;
    if (downloadDir) {
      await fetchFreeSpace(downloadDir);
    }
  }, [fetchStats, fetchSettings, fetchFreeSpace]);

  usePolling(poll, pollingInterval, connectionStatus === 'connected');
}
