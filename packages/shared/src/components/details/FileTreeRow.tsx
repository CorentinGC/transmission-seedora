import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import type { TorrentFileStat } from '../../types/torrent';
import { formatBytes, formatPercent } from '../../lib/format';
import {
  PRIORITY_HIGH,
  PRIORITY_LOW,
  PRIORITY_NORMAL,
  completedBytes,
  cyclePriority,
  getFolderPriority,
  type TreeNode,
} from './file-tree';

/** Clickable priority pill (low / normal / high) of a file or folder. */
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

/** One row of the file tree (recursive for expanded folders). */
export function FileTreeRow({
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
  const progress = node.totalSize > 0 ? completedBytes(node, fileStats) / node.totalSize : 0;

  if (node.isFolder) {
    const folderPriority = getFolderPriority(node, fileStats);
    const folderIndices = node.fileIndices;

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
