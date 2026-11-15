import type { IpcResponse, LaunchTarget } from '../types';

/** What the add-torrent dialog is opened with when the OS hands the app a magnet link or a `.torrent` file. */
export type AddDialogInitial =
  | { mode: 'url'; url: string }
  | { mode: 'file'; filePath: string; fileBase64: string };

/** Narrows an untrusted menu-event payload to a `LaunchTarget`. */
export function isLaunchTarget(value: unknown): value is LaunchTarget {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.kind === 'magnet') return typeof v.uri === 'string' && v.uri !== '';
  if (v.kind === 'torrent-file') return typeof v.filePath === 'string' && v.filePath !== '';
  return false;
}

/**
 * Maps a launch target to the dialog's initial state. A magnet link maps directly; a torrent file
 * is read first and resolves null when it cannot be read (the caller reports it).
 */
export async function resolveLaunchTarget(
  target: LaunchTarget,
  readFileBase64: (filePath: string) => Promise<IpcResponse<string>>,
): Promise<AddDialogInitial | null> {
  if (target.kind === 'magnet') return { mode: 'url', url: target.uri };
  const res = await readFileBase64(target.filePath).catch(() => null);
  if (!res?.success || !res.data) return null;
  return { mode: 'file', filePath: target.filePath, fileBase64: res.data };
}
