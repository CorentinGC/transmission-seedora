import fs from 'node:fs';
import path from 'node:path';
import { readRegularFile } from './approved-paths';

/** Upper bound for a torrent file picked up from the watch folder. */
export const MAX_WATCHED_TORRENT_BYTES = 10_000_000;

/**
 * Revalidates a stored watch folder before the watcher uses it (the config file is user-writable on disk).
 * Returns the resolved real path, or null when it is not an absolute path to an existing directory
 * other than a file system root.
 */
export function validateWatchFolder(folder: string | undefined): string | null {
  if (!folder || !path.isAbsolute(folder)) return null;
  try {
    const real = fs.realpathSync(folder);
    if (path.parse(real).root === real) return null;
    return fs.statSync(real).isDirectory() ? real : null;
  } catch {
    return null;
  }
}

/**
 * Reads a `.torrent` file dropped into the watch folder. Symlinks, non-regular files and other extensions
 * yield null (skipped); a file over the size cap throws `ApprovedPathError`.
 */
export function readWatchedTorrent(filePath: string): Buffer | null {
  if (path.extname(filePath).toLowerCase() !== '.torrent') return null;
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) return null;
  return readRegularFile(filePath, MAX_WATCHED_TORRENT_BYTES);
}
