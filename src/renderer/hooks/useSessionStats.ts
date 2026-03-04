import { useCallback } from 'react';
import { useSessionStore } from '../stores/session-store';
import { useServerStore } from '../stores/server-store';
import { usePolling } from './usePolling';

export function useSessionStats(pollingInterval: number) {
  const fetchStats = useSessionStore((s) => s.fetchStats);
  const fetchSettings = useSessionStore((s) => s.fetchSettings);
  const connectionStatus = useServerStore((s) => s.connectionStatus);

  const poll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchSettings()]);
  }, [fetchStats, fetchSettings]);

  usePolling(poll, pollingInterval, connectionStatus === 'connected');
}
