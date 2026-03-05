import { useEffect, useRef } from 'react';
import { useTorrentStore } from '@shared/stores/torrent-store';
import { useSessionStore } from '@shared/stores/session-store';
import type { Torrent } from '@shared/types/torrent';
import { useApi } from '@shared/platform/api-context';

export function useTrayAndNotifications() {
  const torrents = useTorrentStore((s) => s.torrents);
  const stats = useSessionStore((s) => s.stats);
  const settings = useSessionStore((s) => s.settings);
  const prevTorrentsRef = useRef<Map<number, Torrent>>(new Map());
  const initializedRef = useRef(false);
  const api = useApi();

  // Update tray with current speeds
  useEffect(() => {
    if (!stats || !api.trayUpdate) return;

    const cumStats = stats as unknown as {
      downloadSpeed?: number;
      uploadSpeed?: number;
      activeTorrentCount?: number;
    };

    api.trayUpdate({
      downloadSpeed: cumStats.downloadSpeed ?? 0,
      uploadSpeed: cumStats.uploadSpeed ?? 0,
      activeCount: cumStats.activeTorrentCount ?? 0,
      altSpeedEnabled: settings?.altSpeedEnabled ?? false,
    });
  }, [stats, settings, api]);

  // Detect torrent completions → send notification
  useEffect(() => {
    if (!initializedRef.current) {
      prevTorrentsRef.current = new Map(torrents);
      initializedRef.current = true;
      return;
    }

    const prev = prevTorrentsRef.current;

    for (const [id, torrent] of torrents) {
      const prevTorrent = prev.get(id);
      if (prevTorrent && prevTorrent.percentDone < 1 && torrent.percentDone >= 1) {
        api.notificationShow?.(
          'Download Complete',
          torrent.name,
        );
      }
    }

    prevTorrentsRef.current = new Map(torrents);
  }, [torrents, api]);
}
