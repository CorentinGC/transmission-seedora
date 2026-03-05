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
    // RPC returns hyphenated keys, cast to access the raw key
    const settings = useSessionStore.getState().settings as Record<string, unknown> | null;
    const downloadDir = (settings?.['download-dir'] ?? settings?.downloadDir) as string | undefined;
    if (downloadDir) {
      await fetchFreeSpace(downloadDir);
    }
  }, [fetchStats, fetchSettings, fetchFreeSpace]);

  usePolling(poll, pollingInterval, connectionStatus === 'connected');
}
