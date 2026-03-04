import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import type { Torrent, TorrentFile, TorrentFileStat } from '../../types/torrent';
import { formatBytes, formatPercent } from '../../lib/format';
import { useTorrentStore } from '../../stores/torrent-store';

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
  // Aggregated data for folders
  totalSize: number;
  completedSize: number;
}

function buildFileTree(files: TorrentFile[], fileStats: TorrentFileStat[]): TreeNode {
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

  // Aggregate sizes up through folders
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

  // Sort: folders first, then alphabetical
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

  // If root has a single folder child (common torrent structure), skip it
  if (root.children.length === 1 && root.children[0].isFolder) {
    return root.children[0];
  }

  return root;
}

function FileTreeRow({
  node,
  depth,
  expandedPaths,
  toggleExpanded,
  fileStats,
  toggleWanted,
  setPriority,
}: {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  toggleExpanded: (path: string) => void;
  fileStats: TorrentFileStat[];
  toggleWanted: (index: number, wanted: boolean) => void;
  setPriority: (index: number, priority: number) => void;
}) {
  const { t } = useTranslation();
  const isExpanded = expandedPaths.has(node.path);
  const progress = node.totalSize > 0 ? node.completedSize / node.totalSize : 0;

  if (node.isFolder) {
    return (
      <>
        <div
          className="flex items-center gap-1 px-1 py-0.5 hover:bg-accent cursor-pointer"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => toggleExpanded(node.path)}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Folder size={14} className="text-muted-foreground" />
          <span className="flex-1 truncate">{node.name}</span>
          <span className="w-20 text-right text-muted-foreground">{formatBytes(node.totalSize)}</span>
          <span className="w-16 text-right">{formatPercent(progress)}</span>
          <span className="w-16" />
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
            />
          ))}
      </>
    );
  }

  const stat = node.fileIndex !== undefined ? fileStats[node.fileIndex] : undefined;
  const wanted = stat?.wanted ?? true;
  const priority = stat?.priority ?? 0;

  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5 hover:bg-accent"
      style={{ paddingLeft: `${depth * 16 + 4}px` }}
    >
      <span className="w-3" />
      <input
        type="checkbox"
        checked={wanted}
        onChange={(e) => node.fileIndex !== undefined && toggleWanted(node.fileIndex, e.target.checked)}
        className="w-3.5"
      />
      <File size={14} className="text-muted-foreground" />
      <span className="flex-1 truncate">{node.name}</span>
      <span className="w-20 text-right text-muted-foreground">{formatBytes(node.totalSize)}</span>
      <span className="w-16 text-right">{formatPercent(progress)}</span>
      <select
        className="w-16 text-xs bg-background border rounded px-1"
        value={priority}
        onChange={(e) => node.fileIndex !== undefined && setPriority(node.fileIndex, Number(e.target.value))}
      >
        <option value={-1}>{t('priority.low')}</option>
        <option value={0}>{t('priority.normal')}</option>
        <option value={1}>{t('priority.high')}</option>
      </select>
    </div>
  );
}

export function FilesTab({ torrent }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<DetailedTorrentData | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);

  useEffect(() => {
    let cancelled = false;
    window.api
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
    return buildFileTree(data.files, data.fileStats);
  }, [data]);

  // Auto-expand root folder
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
    (index: number, wanted: boolean) => {
      const key = wanted ? 'files-wanted' : 'files-unwanted';
      setTorrentProps([torrent.id], { [key]: [index] });
    },
    [torrent.id, setTorrentProps],
  );

  const setPriority = useCallback(
    (index: number, priority: number) => {
      const key = priority === 1 ? 'priority-high' : priority === -1 ? 'priority-low' : 'priority-normal';
      setTorrentProps([torrent.id], { [key]: [index] });
    },
    [torrent.id, setTorrentProps],
  );

  if (!data?.files || !tree) {
    return <div className="text-muted-foreground">{t('details.loadingFiles')}</div>;
  }

  return (
    <div className="text-xs">
      <div className="flex items-center gap-1 px-1 py-1 font-medium text-muted-foreground border-b">
        <span className="flex-1">{t('torrent.name')}</span>
        <span className="w-20 text-right">{t('torrent.size')}</span>
        <span className="w-16 text-right">{t('torrent.done')}</span>
        <span className="w-16 text-right">{t('torrent.priority')}</span>
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
        />
      )}
    </div>
  );
}
