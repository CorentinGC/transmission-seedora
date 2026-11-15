import { useEffect, useRef } from 'react';
import { useTorrentStore } from '../stores/torrent-store';
import { useSessionStore } from '../stores/session-store';
import { useUiStore } from '../stores/ui-store';
import { useApi } from '../platform/api-context';
import type { PlatformApi } from '../platform/api-types';

export interface MenuEventHandlers {
  onAddTorrent?: () => void;
  onAddMagnet?: () => void;
  onOpenSettings?: () => void;
  onOpenPreferences?: () => void;
  onRemoveTorrent?: () => void;
}

/** Everything a menu event may act on, read lazily so the subscription never goes stale. */
export interface MenuEventDeps {
  selectedIds: () => number[];
  startTorrents: (ids: number[]) => void;
  stopTorrents: (ids: number[]) => void;
  verifyTorrents: (ids: number[]) => void;
  reannounceTorrents: (ids: number[]) => void;
  startAll: () => void;
  stopAll: () => void;
  toggleAltSpeed: () => void;
  toggleFilterPanel: () => void;
  toggleDetailsPanel: () => void;
  handlers: () => MenuEventHandlers;
}

/** Subscribes every native menu / tray channel once; returns the combined cleanup. */
export function bindMenuEvents(api: Pick<PlatformApi, 'onMenuEvent'>, deps: MenuEventDeps): () => void {
  if (!api.onMenuEvent) return () => {};
  const on = api.onMenuEvent.bind(api);
  const withSelection = (action: (ids: number[]) => void) => () => {
    const ids = deps.selectedIds();
    if (ids.length) action(ids);
  };

  const cleanups = [
    on('menu:add-torrent', () => deps.handlers().onAddTorrent?.()),
    on('menu:add-magnet', () => deps.handlers().onAddMagnet?.()),
    on('menu:settings', () => deps.handlers().onOpenSettings?.()),
    on('menu:preferences', () => deps.handlers().onOpenPreferences?.()),
    on('menu:toggle-filter', () => deps.toggleFilterPanel()),
    on('menu:toggle-details', () => deps.toggleDetailsPanel()),
    on('menu:torrent-start', withSelection(deps.startTorrents)),
    on('menu:torrent-stop', withSelection(deps.stopTorrents)),
    on('menu:torrent-verify', withSelection(deps.verifyTorrents)),
    on('menu:torrent-reannounce', withSelection(deps.reannounceTorrents)),
    on('menu:torrent-remove', () => deps.handlers().onRemoveTorrent?.()),
    on('menu:start-all', () => deps.startAll()),
    on('menu:stop-all', () => deps.stopAll()),
    on('tray:toggle-alt-speed', () => deps.toggleAltSpeed()),
  ];
  return () => cleanups.forEach((fn) => fn());
}

/**
 * Wires native menu events to store actions. The subscription is registered once per
 * platform API: handlers and selection are read through refs / `getState` at event time.
 */
export function useMenuEvents(handlers: MenuEventHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const api = useApi();

  useEffect(
    () =>
      bindMenuEvents(api, {
        selectedIds: () => Array.from(useTorrentStore.getState().selectedIds),
        startTorrents: (ids) => void useTorrentStore.getState().startTorrents(ids),
        stopTorrents: (ids) => void useTorrentStore.getState().stopTorrents(ids),
        verifyTorrents: (ids) => void useTorrentStore.getState().verifyTorrents(ids),
        reannounceTorrents: (ids) => void useTorrentStore.getState().reannounceTorrents(ids),
        startAll: () => void useTorrentStore.getState().startAll(),
        stopAll: () => void useTorrentStore.getState().stopAll(),
        toggleAltSpeed: () => void useSessionStore.getState().toggleAltSpeed(),
        toggleFilterPanel: () => useUiStore.getState().toggleFilterPanel(),
        toggleDetailsPanel: () => useUiStore.getState().toggleDetailsPanel(),
        handlers: () => handlersRef.current,
      }),
    [api],
  );
}
