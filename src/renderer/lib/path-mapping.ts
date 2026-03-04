import type { PathMapping } from '@shared/types';

export function mapRemoteToLocal(remotePath: string, mappings: PathMapping[]): string {
  for (const { remote, local } of mappings) {
    if (!remote || !local) continue;

    const normalizedRemote = remote.endsWith('/') || remote.endsWith('\\') ? remote : remote + '/';
    const normalizedLocal = local.endsWith('/') || local.endsWith('\\') ? local : local + '/';

    if (remotePath.startsWith(normalizedRemote)) {
      return normalizedLocal + remotePath.slice(normalizedRemote.length);
    }
    if (remotePath === remote) {
      return local;
    }
  }
  return remotePath;
}
