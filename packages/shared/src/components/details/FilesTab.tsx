import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Torrent, TorrentFile, TorrentFileStat } from '../../types/torrent';
import { useTorrentStore } from '../../stores/torrent-store';
import { useTorrentFields } from '../../hooks/useTorrentFields';
import { buildFileTree } from './file-tree';
import { FileTreeRow } from './FileTreeRow';
import { FileContextMenu } from './FileContextMenu';

interface Props {
  torrent: Torrent;
}

interface ContextMenuState {
  x: number;
  y: number;
  fileIndices: number[];
  currentPriority: number;
  isWanted: boolean;
}

// File names never change: fetched once per torrent. Only the per-file stats are polled.
const FILE_LIST_FIELDS = ['files'] as const;
const FILE_STATS_FIELDS = ['fileStats'] as const;

export function FilesTab({ torrent }: Props) {
  const { t } = useTranslation();
  const list = useTorrentFields<{ files: TorrentFile[] }>(torrent.id, FILE_LIST_FIELDS, { once: true });
  const stats = useTorrentFields<{ fileStats: TorrentFileStat[] }>(torrent.id, FILE_STATS_FIELDS);
  const { mutate, refresh } = stats;
  const files = list.data?.files ?? null;
  const fileStats = stats.data?.fileStats ?? null;
  const error = list.error ?? stats.error;
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);

  // Rebuilt only when the (immutable) file list changes, not on every stats refresh.
  const tree = useMemo(() => (files ? buildFileTree(files) : null), [files]);

  // Expand the root once per torrent: periodic refreshes rebuild the tree and must
  // not collapse folders the user opened.
  const rootPath = tree?.isFolder ? tree.path : null;
  useEffect(() => {
    if (rootPath !== null) setExpandedPaths(new Set([rootPath]));
  }, [torrent.id, rootPath]);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const applyFileChange = useCallback(
    async (
      props: Record<string, unknown>,
      optimistic: (stat: TorrentFileStat) => TorrentFileStat,
      indices: number[],
    ) => {
      mutate((prev) => {
        const newStats = [...prev.fileStats];
        for (const idx of indices) {
          const stat = newStats[idx];
          if (stat) newStats[idx] = optimistic(stat);
        }
        return { ...prev, fileStats: newStats };
      });
      // A rejected change must not leave the optimistic value on screen.
      if (!(await setTorrentProps([torrent.id], props))) await refresh();
    },
    [torrent.id, setTorrentProps, mutate, refresh],
  );

  const toggleWanted = useCallback(
    (indices: number[], wanted: boolean) => {
      const key = wanted ? 'files-wanted' : 'files-unwanted';
      return applyFileChange({ [key]: indices }, (stat) => ({ ...stat, wanted }), indices);
    },
    [applyFileChange],
  );

  const setPriority = useCallback(
    (indices: number[], priority: number) => {
      const key = priority === 1 ? 'priority-high' : priority === -1 ? 'priority-low' : 'priority-normal';
      return applyFileChange({ [key]: indices }, (stat) => ({ ...stat, priority }), indices);
    },
    [applyFileChange],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, indices: number[], priority: number, wanted: boolean) => {
    setContextMenu({ x: e.clientX, y: e.clientY, fileIndices: indices, currentPriority: priority, isWanted: wanted });
  }, []);

  if (!tree || !fileStats) {
    if (error)
      return (
        <div role="alert" className="text-destructive-text">
          {t('details.loadFailed', { error })}
        </div>
      );
    return <div className="text-muted-foreground">{t('details.loadingFiles')}</div>;
  }

  return (
    <div className="text-xs">
      <div className="flex items-center gap-1 px-1 py-1 font-medium text-muted-foreground border-b">
        <span className="w-14 text-center">{t('torrent.priority')}</span>
        <span className="flex-1">{t('torrent.name')}</span>
        <span className="w-20 text-right">{t('torrent.size')}</span>
        <span className="w-16 text-right">{t('torrent.done')}</span>
      </div>
      {tree.isFolder ? (
        tree.children.map((child) => (
          <FileTreeRow
            key={child.path}
            node={child}
            depth={0}
            expandedPaths={expandedPaths}
            toggleExpanded={toggleExpanded}
            fileStats={fileStats}
            toggleWanted={toggleWanted}
            setPriority={setPriority}
            onContextMenu={handleContextMenu}
          />
        ))
      ) : (
        <FileTreeRow
          node={tree}
          depth={0}
          expandedPaths={expandedPaths}
          toggleExpanded={toggleExpanded}
          fileStats={fileStats}
          toggleWanted={toggleWanted}
          setPriority={setPriority}
          onContextMenu={handleContextMenu}
        />
      )}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          fileIndices={contextMenu.fileIndices}
          currentPriority={contextMenu.currentPriority}
          isWanted={contextMenu.isWanted}
          onSetPriority={setPriority}
          onToggleWanted={toggleWanted}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
