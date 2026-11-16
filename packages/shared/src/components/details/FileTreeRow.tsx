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
  /** Name of the file or folder, so each badge is distinguishable to a screen reader. */
  name: string;
  onClick: (e: React.MouseEvent) => void;
  t: (key: string) => string;
}

function PriorityBadge({ priority, name, onClick, t }: PriorityBadgeProps) {
  const colorClass =
    priority === PRIORITY_HIGH
      ? 'bg-destructive-text/15 text-destructive-text border-destructive-text/30'
      : priority === PRIORITY_LOW
        ? 'bg-muted text-muted-foreground border-border'
        : 'bg-info/15 text-info border-info/30';

  const label =
    priority === PRIORITY_HIGH
      ? t('priority.high')
      : priority === PRIORITY_LOW
        ? t('priority.low')
        : t('priority.normal');

  return (
    <button
      type="button"
      aria-label={`${name}: ${label}`}
      className={`w-14 h-5 pointer-coarse:h-11 text-[10px] font-medium rounded border cursor-pointer select-none transition-colors hover:opacity-80 ${colorClass}`}
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
        {/* Pointer convenience: the button inside is the keyboard and screen-reader path to the same toggle. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className="flex items-center gap-1 px-1 py-0.5 hover:bg-accent cursor-pointer"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => toggleExpanded(node.path)}
          onContextMenu={handleContextMenu}
        >
          <PriorityBadge priority={folderPriority} name={node.name} onClick={handlePriorityClick} t={t} />
          {/* Click handling lives on the row; this button makes the toggle focusable and announced. */}
          <button
            type="button"
            aria-expanded={isExpanded}
            title={node.name}
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
          >
            {isExpanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
            <Folder size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 truncate">{node.name}</span>
          </button>
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
      <PriorityBadge priority={priority} name={node.name} onClick={handlePriorityClick} t={t} />
      <span className="w-3" />
      <input
        type="checkbox"
        checked={wanted}
        aria-label={node.name}
        onChange={(e) => node.fileIndex !== undefined && toggleWanted([node.fileIndex], e.target.checked)}
        className="w-3.5"
      />
      <File size={14} className="text-muted-foreground" />
      <span className="flex-1 truncate" title={node.name}>
        {node.name}
      </span>
      <span className="w-20 text-right text-muted-foreground">{formatBytes(node.totalSize)}</span>
      <span className="w-16 text-right">{formatPercent(progress)}</span>
    </div>
  );
}
