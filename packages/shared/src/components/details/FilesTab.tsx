import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import type { Torrent, TorrentFile, TorrentFileStat } from '../../types/torrent';
import { formatBytes, formatPercent } from '../../lib/format';
import { useTorrentStore } from '../../stores/torrent-store';
import { useApi } from '../../platform/api-context';
import { ContextMenuItem as MenuItem, ContextMenuSeparator as Separator } from '../ui';

interface Props {
  torrent: Torrent;
}

interface DetailedTorrentData {
  files: TorrentFile[];
  fileStats: TorrentFileStat[];
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  fileIndex?: number;
  children: TreeNode[];
  totalSize: number;
  completedSize: number;
}

// Priority helpers
const PRIORITY_LOW = -1;
const PRIORITY_NORMAL = 0;
const PRIORITY_HIGH = 1;

function cyclePriority(current: number): number {
  if (current === PRIORITY_LOW) return PRIORITY_NORMAL;
  if (current === PRIORITY_NORMAL) return PRIORITY_HIGH;
  return PRIORITY_LOW;
}

function buildFileTree(files: TorrentFile[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    isFolder: true,
    children: [],
    totalSize: 0,
    completedSize: 0,
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const parts = file.name.split('/');
    let current = root;

    for (let j = 0; j < parts.length; j++) {
      const part = parts[j];
      const isFile = j === parts.length - 1;
      const path = parts.slice(0, j + 1).join('/');

      if (isFile) {
        current.children.push({
          name: part,
          path,
          isFolder: false,
          fileIndex: i,
          children: [],
          totalSize: file.length,
          completedSize: file.bytesCompleted,
        });
      } else {
        let folder = current.children.find((c) => c.isFolder && c.name === part);
        if (!folder) {
          folder = {
            name: part,
            path,
            isFolder: true,
            children: [],
            totalSize: 0,
            completedSize: 0,
          };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  function aggregateSizes(node: TreeNode): void {
    if (!node.isFolder) return;
    node.totalSize = 0;
    node.completedSize = 0;
    for (const child of node.children) {
      aggregateSizes(child);
      node.totalSize += child.totalSize;
      node.completedSize += child.completedSize;
    }
  }

  function sortTree(node: TreeNode): void {
    node.children.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      if (child.isFolder) sortTree(child);
    }
  }

  aggregateSizes(root);
  sortTree(root);

  if (root.children.length === 1 && root.children[0].isFolder) {
    return root.children[0];
  }

  return root;
}

/** Collect all file indices under a tree node */
function collectFileIndices(node: TreeNode): number[] {
  if (!node.isFolder && node.fileIndex !== undefined) return [node.fileIndex];
  const indices: number[] = [];
  for (const child of node.children) {
    indices.push(...collectFileIndices(child));
  }
  return indices;
}

/** Get the dominant priority for a folder (most common among children) */
function getFolderPriority(node: TreeNode, fileStats: TorrentFileStat[]): number {
  const indices = collectFileIndices(node);
  if (indices.length === 0) return PRIORITY_NORMAL;
  const counts = new Map<number, number>();
  for (const idx of indices) {
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

interface PriorityBadgeProps {
  priority: number;
  onClick: (e: React.MouseEvent) => void;
  t: (key: string) => string;
}

function PriorityBadge({ priority, onClick, t }: PriorityBadgeProps) {
  const colorClass =
    priority === PRIORITY_HIGH
      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
      : priority === PRIORITY_LOW
        ? 'bg-muted text-muted-foreground border-border'
        : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';

  const label =
    priority === PRIORITY_HIGH
      ? t('priority.high')
      : priority === PRIORITY_LOW
        ? t('priority.low')
        : t('priority.normal');

  return (
    <button
      className={`w-14 h-5 text-[10px] font-medium rounded border cursor-pointer select-none transition-colors hover:opacity-80 ${colorClass}`}
      onClick={onClick}
      title={t('filesTab.clickToChangePriority')}
    >
      {label}
    </button>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  fileIndices: number[];
  currentPriority: number;
  isWanted: boolean;
}

function FileTreeRow({
  node,
  depth,
  expandedPaths,
  toggleExpanded,
  fileStats,
  toggleWanted,
  setPriority,
  onContextMenu,
}: {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  toggleExpanded: (path: string) => void;
  fileStats: TorrentFileStat[];
  toggleWanted: (indices: number[], wanted: boolean) => void;
  setPriority: (indices: number[], priority: number) => void;
  onContextMenu: (e: React.MouseEvent, indices: number[], priority: number, wanted: boolean) => void;
}) {
  const { t } = useTranslation();
  const isExpanded = expandedPaths.has(node.path);
  const progress = node.totalSize > 0 ? node.completedSize / node.totalSize : 0;

  if (node.isFolder) {
    const folderPriority = getFolderPriority(node, fileStats);
    const folderIndices = collectFileIndices(node);

    const handlePriorityClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setPriority(folderIndices, cyclePriority(folderPriority));
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, folderIndices, folderPriority, true);
    };

    return (
      <>
        <div
          className="flex items-center gap-1 px-1 py-0.5 hover:bg-accent cursor-pointer"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => toggleExpanded(node.path)}
          onContextMenu={handleContextMenu}
        >
          <PriorityBadge priority={folderPriority} onClick={handlePriorityClick} t={t} />
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Folder size={14} className="text-muted-foreground" />
          <span className="flex-1 truncate">{node.name}</span>
          <span className="w-20 text-right text-muted-foreground">{formatBytes(node.totalSize)}</span>
          <span className="w-16 text-right">{formatPercent(progress)}</span>
        </div>
        {isExpanded &&
          node.children.map((child) => (
            <FileTreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
              fileStats={fileStats}
              toggleWanted={toggleWanted}
              setPriority={setPriority}
              onContextMenu={onContextMenu}
            />
          ))}
      </>
    );
  }

  const stat = node.fileIndex !== undefined ? fileStats[node.fileIndex] : undefined;
  const wanted = stat?.wanted ?? true;
  const priority = stat?.priority ?? PRIORITY_NORMAL;

  const handlePriorityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.fileIndex !== undefined) {
      setPriority([node.fileIndex], cyclePriority(priority));
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.fileIndex !== undefined) {
      onContextMenu(e, [node.fileIndex], priority, wanted);
    }
  };

  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5 hover:bg-accent"
      style={{ paddingLeft: `${depth * 16 + 4}px` }}
      onContextMenu={handleContextMenu}
    >
      <PriorityBadge priority={priority} onClick={handlePriorityClick} t={t} />
      <span className="w-3" />
      <input
        type="checkbox"
        checked={wanted}
        onChange={(e) => node.fileIndex !== undefined && toggleWanted([node.fileIndex], e.target.checked)}
        className="w-3.5"
      />
      <File size={14} className="text-muted-foreground" />
      <span className="flex-1 truncate">{node.name}</span>
      <span className="w-20 text-right text-muted-foreground">{formatBytes(node.totalSize)}</span>
      <span className="w-16 text-right">{formatPercent(progress)}</span>
    </div>
  );
}

function FileContextMenu({
  x,
  y,
  fileIndices,
  currentPriority,
  isWanted,
  onSetPriority,
  onToggleWanted,
  onClose,
}: {
  x: number;
  y: number;
  fileIndices: number[];
  currentPriority: number;
  isWanted: boolean;
  onSetPriority: (indices: number[], priority: number) => void;
  onToggleWanted: (indices: number[], wanted: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 w-48 rounded-md border bg-popover shadow-lg py-1 text-sm"
      style={{ left: x, top: y }}
    >
      <div className="px-2 py-1 text-xs text-muted-foreground">{t('torrent.priority')}</div>
      <MenuItem
        label={t('priority.high')}
        onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_HIGH))}
        indent
        className={currentPriority === PRIORITY_HIGH ? 'text-red-500 font-medium' : ''}
      />
      <MenuItem
        label={t('priority.normal')}
        onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_NORMAL))}
        indent
        className={currentPriority === PRIORITY_NORMAL ? 'text-blue-500 font-medium' : ''}
      />
      <MenuItem
        label={t('priority.low')}
        onClick={() => act(() => onSetPriority(fileIndices, PRIORITY_LOW))}
        indent
        className={currentPriority === PRIORITY_LOW ? 'font-medium' : ''}
      />
      <Separator />
      <MenuItem
        label={isWanted ? t('filesTab.doNotDownload') : t('filesTab.download')}
        onClick={() => act(() => onToggleWanted(fileIndices, !isWanted))}
      />
    </div>
  );
}

export function FilesTab({ torrent }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<DetailedTorrentData | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);
  const api = useApi();

  useEffect(() => {
    let cancelled = false;
    api
      .rpcTorrentGet(['files', 'fileStats'], [torrent.id])
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          const d = res.data as { torrents: DetailedTorrentData[] };
          if (d.torrents?.[0]) setData(d.torrents[0]);
        }
      });
    return () => { cancelled = true; };
  }, [torrent.id]);

  const tree = useMemo(() => {
    if (!data?.files) return null;
    return buildFileTree(data.files);
  }, [data]);

  useEffect(() => {
    if (tree?.isFolder) {
      setExpandedPaths(new Set([tree.path]));
    }
  }, [tree]);

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

  const toggleWanted = useCallback(
    (indices: number[], wanted: boolean) => {
      const key = wanted ? 'files-wanted' : 'files-unwanted';
      setTorrentProps([torrent.id], { [key]: indices });
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const newStats = [...prev.fileStats];
        for (const idx of indices) {
          newStats[idx] = { ...newStats[idx], wanted };
        }
        return { ...prev, fileStats: newStats };
      });
    },
    [torrent.id, setTorrentProps],
  );

  const setPriority = useCallback(
    (indices: number[], priority: number) => {
      const key = priority === 1 ? 'priority-high' : priority === -1 ? 'priority-low' : 'priority-normal';
      setTorrentProps([torrent.id], { [key]: indices });
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const newStats = [...prev.fileStats];
        for (const idx of indices) {
          newStats[idx] = { ...newStats[idx], priority };
        }
        return { ...prev, fileStats: newStats };
      });
    },
    [torrent.id, setTorrentProps],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, indices: number[], priority: number, wanted: boolean) => {
      setContextMenu({ x: e.clientX, y: e.clientY, fileIndices: indices, currentPriority: priority, isWanted: wanted });
    },
    [],
  );

  if (!data?.files || !tree) {
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
            fileStats={data.fileStats}
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
          fileStats={data.fileStats}
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
