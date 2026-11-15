import { useEffect } from 'react';
import i18n from 'i18next';
import { useServerStore } from '../stores/server-store';
import { useUiStore } from '../stores/ui-store';
import { useApi } from '../platform/api-context';
import { guardedCall } from '../lib/guarded-call';
import type { AppPreferences } from '../types';
import type { ServerConfig } from '../types/server';
import { useApplyTheme } from './useApplyTheme';

/** Chooses which server to reconnect to once the list is loaded; defaults to the first one. */
export type PickInitialServer = (servers: readonly ServerConfig[]) => string | null;

const pickFirstServer: PickInitialServer = (servers) => servers[0]?.id ?? null;

/** Column and preset state stored in the preferences, restored without re-persisting it. */
function storedLayoutState(prefs: AppPreferences): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  if (prefs.columnVisibility && Object.keys(prefs.columnVisibility).length > 0) {
    state.columnVisibility = prefs.columnVisibility;
  }
  if (prefs.columnSizing && Object.keys(prefs.columnSizing).length > 0) {
    state.columnSizing = prefs.columnSizing;
  }
  if (prefs.columnOrder && prefs.columnOrder.length > 0) state.columnOrder = prefs.columnOrder;
  if (prefs.speedPresets) state.speedPresets = prefs.speedPresets;
  return state;
}

/**
 * Startup logic shared by the Electron and web roots: loads the server list and the saved
 * preferences (a failure is reported to the user), reconnects to a server and applies the theme.
 */
export function useAppBootstrap(pickInitialServer: PickInitialServer = pickFirstServer): void {
  const api = useApi();
  const fetchServers = useServerStore((s) => s.fetchServers);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const setTheme = useUiStore((s) => s.setTheme);
  const setPollingInterval = useUiStore((s) => s.setPollingInterval);
  const setRelativeDates = useUiStore((s) => s.setRelativeDates);

  useEffect(() => {
    fetchServers();
    void guardedCall(() => api.prefsGet(), 'notification.prefsLoadFailed').then((res) => {
      const prefs = res?.data;
      if (!prefs) return;
      setTheme(prefs.theme);
      setPollingInterval(prefs.pollingInterval);
      setRelativeDates(prefs.relativeDates);
      if (prefs.language && prefs.language !== i18n.language) void i18n.changeLanguage(prefs.language);
      const layout = storedLayoutState(prefs);
      if (Object.keys(layout).length > 0) useUiStore.setState(layout);
    });
  }, [api, fetchServers, setTheme, setPollingInterval, setRelativeDates]);

  useEffect(() => {
    if (servers.length === 0 || activeServerId) return;
    const initialId = pickInitialServer(servers);
    if (initialId) setActiveServer(initialId);
  }, [servers, activeServerId, setActiveServer, pickInitialServer]);

  useApplyTheme();
}
