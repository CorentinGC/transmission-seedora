import fs from 'node:fs';
import path from 'node:path';
import { connectionManager } from './rpc/connection-manager';
import { configStore } from './store/config-store';

let watcher: { close: () => Promise<void> } | null = null;

export async function startWatcher(): Promise<void> {
  await stopWatcher();

  const prefs = configStore.getPreferences();
  if (!prefs.watchFolderEnabled || !prefs.watchFolder) return;

  const watchPath = prefs.watchFolder;

  if (!fs.existsSync(watchPath)) {
    console.warn(`[Watcher] Watch folder does not exist: ${watchPath}`);
    return;
  }

  console.log(`[Watcher] Watching: ${watchPath}`);

  // Dynamic import for ESM-only chokidar
  // Watch directory (not glob — chokidar v5 dropped glob support)
  const chokidar = await import('chokidar');
  const w = chokidar.watch(watchPath, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200,
    },
  });

  w.on('add', async (filePath: string) => {
    if (!filePath.endsWith('.torrent')) return;
    console.log(`[Watcher] New torrent file detected: ${filePath}`);

    try {
      const client = connectionManager.getActiveClient();
      if (!client) {
        console.warn('[Watcher] No active connection, skipping');
        return;
      }

      const content = fs.readFileSync(filePath);
      const base64 = content.toString('base64');

      await client.request('torrent-add', { metainfo: base64 });
      console.log(`[Watcher] Added torrent: ${path.basename(filePath)}`);

      const currentPrefs = configStore.getPreferences();
      if (currentPrefs.deleteWatchedTorrent) {
        fs.unlinkSync(filePath);
        console.log(`[Watcher] Deleted: ${path.basename(filePath)}`);
      }
    } catch (err) {
      console.error(`[Watcher] Error adding torrent:`, err);
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
