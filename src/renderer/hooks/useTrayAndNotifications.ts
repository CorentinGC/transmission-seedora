import { useEffect, useRef } from 'react';
import { useTorrentStore } from '../stores/torrent-store';
import { useSessionStore } from '../stores/session-store';
import type { Torrent } from '../types/torrent';

export function useTrayAndNotifications() {
  const torrents = useTorrentStore((s) => s.torrents);
  const stats = useSessionStore((s) => s.stats);
  const settings = useSessionStore((s) => s.settings);
  const prevTorrentsRef = useRef<Map<number, Torrent>>(new Map());
  const initializedRef = useRef(false);

  // Update tray with current speeds
  useEffect(() => {
    if (!stats || !window.api.trayUpdate) return;

    const cumStats = stats as unknown as {
      downloadSpeed?: number;
      uploadSpeed?: number;
      activeTorrentCount?: number;
    };

    window.api.trayUpdate({
      downloadSpeed: cumStats.downloadSpeed ?? 0,
      uploadSpeed: cumStats.uploadSpeed ?? 0,
      activeCount: cumStats.activeTorrentCount ?? 0,
      altSpeedEnabled: ((settings as Record<string, unknown> | null)?.['alt-speed-enabled'] ?? settings?.altSpeedEnabled ?? false) as boolean,
    });
  }, [stats, settings]);

  // Detect torrent completions → send notification
  useEffect(() => {
    if (!initializedRef.current) {
      // Skip first render to avoid notifying for already-complete torrents
      prevTorrentsRef.current = new Map(torrents);
      initializedRef.current = true;
      return;
    }

    const prev = prevTorrentsRef.current;

    for (const [id, torrent] of torrents) {
      const prevTorrent = prev.get(id);
      if (prevTorrent && prevTorrent.percentDone < 1 && torrent.percentDone >= 1) {
        window.api.notificationShow(
          'Download Complete',
          torrent.name,
        );
      }
    }

    prevTorrentsRef.current = new Map(torrents);
  }, [torrents]);
}
