import fs from 'node:fs';
import path from 'node:path';
import { connectionManager } from './rpc/connection-manager';
import { configStore } from './store/config-store';
import { readWatchedTorrent, validateWatchFolder } from './security/watch-folder';

let watcher: { close: () => Promise<void> } | null = null;

export async function startWatcher(): Promise<void> {
  await stopWatcher();

  const prefs = configStore.getPreferences();
  if (!prefs.watchFolderEnabled || !prefs.watchFolder) return;

  const watchPath = validateWatchFolder(prefs.watchFolder);
  if (!watchPath) {
    console.warn('[Watcher] Stored watch folder is not an absolute path to an existing directory, not watching');
    return;
  }

  console.log(`[Watcher] Watching: ${watchPath}`);

  // Dynamic import for ESM-only chokidar
  // Watch directory (not glob — chokidar v5 dropped glob support)
  const chokidar = await import('chokidar');
  const w = chokidar.watch(watchPath, {
    ignoreInitial: true,
    depth: 0,
    followSymlinks: false,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200,
    },
  });

  w.on('add', async (filePath: string) => {
    try {
      const client = connectionManager.getActiveClient();
      if (!client) {
        console.warn('[Watcher] No active connection, skipping');
        return;
      }

      const content = readWatchedTorrent(filePath);
      if (!content) return;
      console.log(`[Watcher] New torrent file detected: ${path.basename(filePath)}`);
      const base64 = content.toString('base64');

      await client.request('torrent-add', { metainfo: base64 });
      console.log(`[Watcher] Added torrent: ${path.basename(filePath)}`);

      const currentPrefs = configStore.getPreferences();
      if (currentPrefs.deleteWatchedTorrent) {
        fs.unlinkSync(filePath);
        console.log(`[Watcher] Deleted: ${path.basename(filePath)}`);
      }
    } catch (err) {
      console.error('[Watcher] Error adding torrent:', err instanceof Error ? err.message : 'unknown error');
    }
  });

  w.on('error', (err: unknown) => {
    console.error(`[Watcher] Error:`, err);
  });

  watcher = w;
}

export async function stopWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
    console.log('[Watcher] Stopped');
  }
}

export async function restartWatcher(): Promise<void> {
  await startWatcher();
}
