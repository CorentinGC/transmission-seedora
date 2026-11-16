import { describe, expect, it } from 'vitest';
import type { TorrentFile, TorrentFileStat } from '../../types/torrent';
import { buildFileTree, completedBytes, getFolderPriority } from './file-tree';

const file = (name: string, length: number): TorrentFile => ({ name, length, bytesCompleted: 0 });
const stat = (bytesCompleted: number, priority = 0): TorrentFileStat => ({ bytesCompleted, wanted: true, priority });

describe('buildFileTree', () => {
  const files = [file('T/b.txt', 20), file('T/dir/z.bin', 5), file('T/dir/a.bin', 7)];

  it('unwraps a single top-level folder and sorts folders first, then by name', () => {
    const tree = buildFileTree(files);
    expect(tree.name).toBe('T');
    expect(tree.children.map((c) => c.name)).toEqual(['dir', 'b.txt']);
    expect(tree.children[0]?.children.map((c) => c.name)).toEqual(['a.bin', 'z.bin']);
  });

  it('aggregates sizes and file indices from the file list only', () => {
    const tree = buildFileTree(files);
    expect(tree.totalSize).toBe(32);
    expect(tree.fileIndices.sort()).toEqual([0, 1, 2]);
    expect(tree.children[0]?.fileIndices.sort()).toEqual([1, 2]);
  });

  it('keeps the synthetic root when there are several top-level entries', () => {
    const tree = buildFileTree([file('a.txt', 1), file('b.txt', 2)]);
    expect(tree.path).toBe('');
    expect(tree.children).toHaveLength(2);
  });
});

describe('completedBytes / getFolderPriority', () => {
  it('sums the live per-file stats of a node', () => {
    const tree = buildFileTree([file('a', 10), file('b', 10)]);
    expect(completedBytes(tree, [stat(4), stat(6)])).toBe(10);
    expect(completedBytes(tree, [stat(4)])).toBe(4);
  });

  it('returns the most common priority, normal when empty', () => {
    const tree = buildFileTree([file('a', 1), file('b', 1), file('c', 1)]);
    expect(getFolderPriority(tree, [stat(0, 1), stat(0, 1), stat(0, -1)])).toBe(1);
    expect(getFolderPriority(buildFileTree([]), [])).toBe(0);
  });
});
