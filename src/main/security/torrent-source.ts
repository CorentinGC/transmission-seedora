import { ApprovedPathError, approvedPaths } from './approved-paths';

const MAX_TORRENT_BYTES = 10_000_000;
const REMOTE_SOURCE = /^(?:magnet:|https?:\/\/|ftp:\/\/|[0-9a-f]{40}$)/i;
/** POSIX absolute, Windows drive or UNC path, or a `file:` URL: all name something on this machine. */
const LOCAL_PATH = /^(?:[\\/]|[A-Za-z]:[\\/]|file:)/i;

/** Reads a `.torrent` file the user picked in a native dialog; the only reader for torrent files. */
export function readApprovedTorrent(filePath: string): Buffer {
  return approvedPaths.read(filePath, { kind: 'torrent', extensions: ['.torrent'], maxBytes: MAX_TORRENT_BYTES });
}

/** Reads an approved `.torrent` file; injectable for tests. */
export type TorrentFileReader = (filePath: string) => Buffer;

/**
 * Turns `torrent-add` params into what is safe to send to the daemon.
 * - A magnet link, URL or info hash passes through.
 * - An absolute local path (or `file:` URL) is read here, only if the user picked it in a native dialog,
 *   and sent as base64 metainfo.
 * - Anything else (a relative name) is not a path this machine can resolve; it passes through and the
 *   daemon interprets it on its own side.
 * @throws ApprovedPathError when a local file is not approved or not a valid torrent file
 */
export function resolveTorrentAddParams(
  params: Record<string, unknown>,
  readFile: TorrentFileReader = readApprovedTorrent,
): Record<string, unknown> {
  const { filename, metainfo } = params;
  if (typeof filename !== 'string') return params;
  if (typeof metainfo === 'string') throw new ApprovedPathError('Provide either filename or metainfo, not both');
  const trimmed = filename.trim();
  if (REMOTE_SOURCE.test(trimmed) || !LOCAL_PATH.test(trimmed)) return params;

  const { filename: _drop, ...rest } = params;
  return { ...rest, metainfo: readFile(filename).toString('base64') };
}
