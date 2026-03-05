'use client';

import { useEffect } from 'react';
import i18n from './i18n';
import { AppShell } from '@shared/components/layout/AppShell';
import { useServerStore } from '@shared/stores/server-store';
import { useUiStore } from '@shared/stores/ui-store';
import { useApi } from '@shared/platform/api-context';

export function WebApp() {
  const fetchServers = useServerStore((s) => s.fetchServers);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setPollingInterval = useUiStore((s) => s.setPollingInterval);
  const setRelativeDates = useUiStore((s) => s.setRelativeDates);
  const setConfirmOnAdd = useUiStore((s) => s.setConfirmOnAdd);

  const api = useApi();

  // Load saved preferences on startup
  useEffect(() => {
    fetchServers();
    api.prefsGet().then((res) => {
      if (res.success && res.data) {
        setTheme(res.data.theme);
        setPollingInterval(res.data.pollingInterval);
        setRelativeDates(res.data.relativeDates);
        setConfirmOnAdd(res.data.confirmOnAdd);
        if (res.data.language && res.data.language !== i18n.language) {
          i18n.changeLanguage(res.data.language);
        }
        // Restore column state directly (avoid triggering persist)
        const columnState: Record<string, unknown> = {};
        if (res.data.columnVisibility && Object.keys(res.data.columnVisibility).length > 0) {
          columnState.columnVisibility = res.data.columnVisibility;
        }
        if (res.data.columnSizing && Object.keys(res.data.columnSizing).length > 0) {
          columnState.columnSizing = res.data.columnSizing;
        }
        if (res.data.columnOrder && res.data.columnOrder.length > 0) {
          columnState.columnOrder = res.data.columnOrder;
        }
        if (res.data.speedPresets) {
          columnState.speedPresets = res.data.speedPresets;
        }
        if (Object.keys(columnState).length > 0) {
          useUiStore.setState(columnState);
        }
      }
    });
  }, [fetchServers, setTheme, setPollingInterval, setRelativeDates, setConfirmOnAdd]);

  // Auto-connect to the first server after servers are loaded
  useEffect(() => {
    if (servers.length > 0 && !activeServerId) {
      setActiveServer(servers[0].id);
    }
  }, [servers, activeServerId, setActiveServer]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return <AppShell />;
}
