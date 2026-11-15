import { app, type BrowserWindow } from 'electron';
import { z } from 'zod';
import { IPC } from '@ipc/ipc-channels';
import type { IpcResponse, LaunchTarget as LaunchTargetPayload } from '@shared/types';
import { approvedPaths } from '../security/approved-paths';
import { handleGuarded, type SenderValidator } from '../security/ipc-guard';
import { LaunchQueue } from './launch-queue';
import { parseLaunchArg, parseLaunchArgs, type LaunchTarget } from './launch-targets';

/** Brings the window back from the tray / minimized state. */
export function revealWindow(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

const isLive = (window: BrowserWindow | null): window is BrowserWindow => window !== null && !window.isDestroyed();

/**
 * Wires magnet links and `.torrent` files opened through the OS (macOS `open-url` / `open-file`, argv on
 * Windows and Linux, `second-instance` forwarding) into one validated queue the renderer pulls from.
 * Call before `ready`: macOS can deliver `open-url` / `open-file` earlier than that.
 * `ensureWindow` re-creates the window when the app is alive without one (macOS) and returns it.
 */
export function registerLaunchHandling(
  isTrusted: SenderValidator,
  getWindow: () => BrowserWindow | null,
  ensureWindow: () => BrowserWindow | null = getWindow,
) {
  const queue = new LaunchQueue((target) => {
    const window = getWindow();
    if (!isLive(window)) return false;
    window.webContents.send(IPC.LAUNCH_TARGET, target);
    return true;
  });

  const submit = (target: LaunchTarget): void => {
    // The user opened this file through the OS, so main (not the renderer) vouches for it: from here on it
    // goes through the same approved-file reader as a dialog selection.
    if (target.kind === 'torrent-file') approvedPaths.approve([target.filePath], 'torrent');
    queue.enqueue(target);
    revealWindow(isLive(getWindow()) ? getWindow() : ensureWindow());
  };

  const handleArgv = (argv: readonly string[], cwd: string): void => {
    for (const target of parseLaunchArgs(argv, cwd)) submit(target);
  };

  app.on('open-url', (event, url) => {
    event.preventDefault();
    const target = parseLaunchArg(url, process.cwd());
    if (target?.kind === 'magnet') submit(target);
  });
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    const target = parseLaunchArg(filePath, process.cwd());
    if (target?.kind === 'torrent-file') submit(target);
  });

  handleGuarded(isTrusted, IPC.LAUNCH_TAKE, z.tuple([]), (): IpcResponse<LaunchTargetPayload[]> => ({ success: true, data: queue.take() }));

  return {
    handleArgv,
    /** The renderer page is (re)loading: targets wait again until it pulls. */
    resetRenderer: () => queue.reset(),
  };
}
