import type { TorrentFile, TorrentFileStat } from '../../types/torrent';

export const PRIORITY_LOW = -1;
export const PRIORITY_NORMAL = 0;
export const PRIORITY_HIGH = 1;

/** Node of the file tree; built from the immutable file list only, never from live stats. */
export interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  /** Index into the torrent's file list (files only). */
  fileIndex?: number;
  children: TreeNode[];
  totalSize: number;
  /** Indices of every file under this node (itself for a file). */
  fileIndices: number[];
}

/** Next priority in the low -> normal -> high cycle. */
export function cyclePriority(current: number): number {
  if (current === PRIORITY_LOW) return PRIORITY_NORMAL;
  if (current === PRIORITY_NORMAL) return PRIORITY_HIGH;
  return PRIORITY_LOW;
}

function folderNode(name: string, path: string): TreeNode {
  return { name, path, isFolder: true, children: [], totalSize: 0, fileIndices: [] };
}

/**
 * Builds the folder tree of a torrent from its file names. A single top-level
 * folder is unwrapped. Progress is not stored: see `completedBytes`.
 */
export function buildFileTree(files: TorrentFile[]): TreeNode {
  const root = folderNode('', '');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const parts = file.name.split('/');
    let current = root;

    for (let j = 0; j < parts.length; j++) {
      const part = parts[j];
      if (part === undefined) continue;
      const path = parts.slice(0, j + 1).join('/');

      if (j === parts.length - 1) {
        current.children.push({
          name: part,
          path,
          isFolder: false,
          fileIndex: i,
          children: [],
          totalSize: file.length,
          fileIndices: [i],
        });
        continue;
      }
      let folder = current.children.find((c) => c.isFolder && c.name === part);
      if (!folder) {
        folder = folderNode(part, path);
        current.children.push(folder);
      }
      current = folder;
    }
  }

  finalize(root);

  const [onlyChild] = root.children;
  if (root.children.length === 1 && onlyChild?.isFolder) return onlyChild;
  return root;
}

/** Sorts children (folders first, then by name) and rolls sizes and indices up. */
function finalize(node: TreeNode): void {
  node.children.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    if (!child.isFolder) continue;
    finalize(child);
  }
  if (!node.isFolder) return;
  node.totalSize = 0;
  node.fileIndices = [];
  for (const child of node.children) {
    node.totalSize += child.totalSize;
    for (const idx of child.fileIndices) node.fileIndices.push(idx);
  }
}

/** Bytes downloaded under `node`, from the live per-file stats. */
export function completedBytes(node: TreeNode, fileStats: TorrentFileStat[]): number {
  let sum = 0;
  for (const idx of node.fileIndices) sum += fileStats[idx]?.bytesCompleted ?? 0;
  return sum;
}

/** The dominant priority of a node's files (most common; first wins a tie). */
export function getFolderPriority(node: TreeNode, fileStats: TorrentFileStat[]): number {
  if (node.fileIndices.length === 0) return PRIORITY_NORMAL;
  const counts = new Map<number, number>();
  for (const idx of node.fileIndices) {
    const p = fileStats[idx]?.priority ?? PRIORITY_NORMAL;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let maxCount = 0;
  let dominant = PRIORITY_NORMAL;
  for (const [p, c] of counts) {
    if (c > maxCount) {
      maxCount = c;
      dominant = p;
    }
  }
  return dominant;
}
