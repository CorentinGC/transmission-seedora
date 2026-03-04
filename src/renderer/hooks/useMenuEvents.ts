import { useEffect } from 'react';
import { useTorrentStore } from '../stores/torrent-store';
import { useSessionStore } from '../stores/session-store';
import { useUiStore } from '../stores/ui-store';

interface MenuEventHandlers {
  onAddTorrent?: () => void;
  onAddMagnet?: () => void;
  onOpenSettings?: () => void;
  onOpenPreferences?: () => void;
  onRemoveTorrent?: () => void;
}

export function useMenuEvents(handlers: MenuEventHandlers) {
  const startTorrents = useTorrentStore((s) => s.startTorrents);
  const stopTorrents = useTorrentStore((s) => s.stopTorrents);
  const verifyTorrents = useTorrentStore((s) => s.verifyTorrents);
  const reannounceTorrents = useTorrentStore((s) => s.reannounceTorrents);
  const startAll = useTorrentStore((s) => s.startAll);
  const stopAll = useTorrentStore((s) => s.stopAll);
  const selectedIds = useTorrentStore((s) => s.selectedIds);
  const toggleAltSpeed = useSessionStore((s) => s.toggleAltSpeed);
  const toggleFilterPanel = useUiStore((s) => s.toggleFilterPanel);
  const toggleDetailsPanel = useUiStore((s) => s.toggleDetailsPanel);

  useEffect(() => {
    if (!window.api.onMenuEvent) return;

    const cleanups = [
      window.api.onMenuEvent('menu:add-torrent', () => handlers.onAddTorrent?.()),
      window.api.onMenuEvent('menu:add-magnet', () => handlers.onAddMagnet?.()),
      window.api.onMenuEvent('menu:settings', () => handlers.onOpenSettings?.()),
      window.api.onMenuEvent('menu:preferences', () => handlers.onOpenPreferences?.()),
      window.api.onMenuEvent('menu:toggle-filter', () => toggleFilterPanel()),
      window.api.onMenuEvent('menu:toggle-details', () => toggleDetailsPanel()),
      window.api.onMenuEvent('menu:torrent-start', () => {
        const ids = Array.from(selectedIds);
        if (ids.length) startTorrents(ids);
      }),
      window.api.onMenuEvent('menu:torrent-stop', () => {
        const ids = Array.from(selectedIds);
        if (ids.length) stopTorrents(ids);
      }),
      window.api.onMenuEvent('menu:torrent-verify', () => {
        const ids = Array.from(selectedIds);
        if (ids.length) verifyTorrents(ids);
      }),
      window.api.onMenuEvent('menu:torrent-reannounce', () => {
        const ids = Array.from(selectedIds);
        if (ids.length) reannounceTorrents(ids);
      }),
      window.api.onMenuEvent('menu:torrent-remove', () => handlers.onRemoveTorrent?.()),
      window.api.onMenuEvent('menu:start-all', () => startAll()),
      window.api.onMenuEvent('menu:stop-all', () => stopAll()),
      window.api.onMenuEvent('tray:toggle-alt-speed', () => toggleAltSpeed()),
    ];

    return () => cleanups.forEach((fn) => fn());
  }, [
    handlers, selectedIds, startTorrents, stopTorrents, verifyTorrents,
    reannounceTorrents, startAll, stopAll, toggleAltSpeed, toggleFilterPanel, toggleDetailsPanel,
  ]);
}
