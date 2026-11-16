import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Something the OS asked Seedora to open: a magnet link or a `.torrent` file on this machine. */
export type LaunchTarget = { kind: 'magnet'; uri: string } | { kind: 'torrent-file'; filePath: string };

const MAX_MAGNET_CHARS = 8192;
const MAX_PATH_CHARS = 4096;
const MAGNET = /^magnet:\?[^\s\p{Cc}]*\bxt=urn:(?:btih|btmh):[^\s\p{Cc}&]+[^\s\p{Cc}]*$/iu;

function toLocalPath(arg: string): string | null {
  if (/^file:/i.test(arg)) {
    try {
      return fileURLToPath(arg);
    } catch {
      return null;
    }
  }
  // Any other scheme (https:, ftp:, ...) is not a local file; a lone letter before ':' is a Windows drive.
  return /^[A-Za-z][A-Za-z0-9+.-]+:/.test(arg) ? null : arg;
}

/** On Windows a UNC (two leading slashes) or device (`//?/`) path would make main open a network or special location. */
function isRemoteWindowsPath(local: string): boolean {
  return process.platform === 'win32' && /^[\\/]{2}/.test(local);
}

/**
 * Validates one command-line / OS-open argument. Only a well-formed magnet URI or a path ending in
 * `.torrent` qualifies; everything else (flags, other schemes, other files) is ignored. Relative paths
 * resolve against `cwd`, the directory the launching process ran in.
 */
export function parseLaunchArg(arg: string, cwd: string): LaunchTarget | null {
  if (typeof arg !== 'string' || arg.startsWith('-')) return null;
  const trimmed = arg.trim();
  if (/^magnet:/i.test(trimmed)) {
    return trimmed.length <= MAX_MAGNET_CHARS && MAGNET.test(trimmed) ? { kind: 'magnet', uri: trimmed } : null;
  }
  if (trimmed.length > MAX_PATH_CHARS || /\p{Cc}/u.test(trimmed)) return null;
  const local = toLocalPath(trimmed);
  if (!local || isRemoteWindowsPath(local) || path.extname(local).toLowerCase() !== '.torrent') return null;
  return { kind: 'torrent-file', filePath: path.resolve(cwd, local) };
}

/** The launch targets found in an argv, in order (the program and flags are skipped). */
export function parseLaunchArgs(argv: readonly string[], cwd: string): LaunchTarget[] {
  return argv.map((arg) => parseLaunchArg(arg, cwd)).filter((target): target is LaunchTarget => target !== null);
}
