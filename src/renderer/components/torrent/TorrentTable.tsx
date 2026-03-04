import { useMemo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTorrentStore } from '../../stores/torrent-store';
import { useUiStore } from '../../stores/ui-store';
import { createTorrentColumns, DEFAULT_VISIBLE_COLUMNS } from './TorrentColumns';
import { TorrentContextMenu } from './TorrentContextMenu';
import type { Torrent } from '../../types/torrent';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface Props {
  torrents: Torrent[];
}

export function TorrentTable({ torrents }: Props) {
  const { t } = useTranslation();
  const sortingState = useTorrentStore((s) => s.sortingState);
  const setSortingState = useTorrentStore((s) => s.setSortingState);
  const selectedIds = useTorrentStore((s) => s.selectedIds);
  const selectTorrent = useTorrentStore((s) => s.selectTorrent);
  const toggleTorrent = useTorrentStore((s) => s.toggleTorrent);
  const selectRange = useTorrentStore((s) => s.selectRange);

  const columnVisibility = useUiStore((s) => s.columnVisibility);
  const columnSizing = useUiStore((s) => s.columnSizing);
  const setColumnSizing = useUiStore((s) => s.setColumnSizing);
  const relativeDates = useUiStore((s) => s.relativeDates);

  const columns = useMemo(() => createTorrentColumns(relativeDates, t), [relativeDates, t]);

  const parentRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ids: number[] } | null>(null);

  const effectiveVisibility = useMemo(
    () => (Object.keys(columnVisibility).length > 0 ? columnVisibility : DEFAULT_VISIBLE_COLUMNS),
    [columnVisibility],
  );

  const table = useReactTable({
    data: torrents,
    columns: columns as ColumnDef<Torrent, unknown>[],
    state: {
      sorting: sortingState,
      columnVisibility: effectiveVisibility,
      columnSizing,
    },
    onSortingChange: setSortingState,
    onColumnSizingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnSizing) : updater;
      setColumnSizing(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    getRowId: (row) => String(row.id),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  const allVisibleIds = useMemo(() => rows.map((r) => r.original.id), [rows]);

  const handleRowClick = useCallback(
    (torrentId: number, e: React.MouseEvent) => {
      if (e.shiftKey) {
        selectRange(torrentId, allVisibleIds);
      } else if (e.metaKey || e.ctrlKey) {
        toggleTorrent(torrentId);
      } else {
        selectTorrent(torrentId);
      }
    },
    [selectTorrent, toggleTorrent, selectRange, allVisibleIds],
  );

  const handleContextMenu = useCallback(
    (torrentId: number, e: React.MouseEvent) => {
      e.preventDefault();
      // If right-clicking on an unselected torrent, select it
      if (!selectedIds.has(torrentId)) {
        selectTorrent(torrentId);
        setContextMenu({ x: e.clientX, y: e.clientY, ids: [torrentId] });
      } else {
        setContextMenu({ x: e.clientX, y: e.clientY, ids: Array.from(selectedIds) });
      }
    },
    [selectedIds, selectTorrent],
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex border-b bg-muted/50 select-none">
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div
              key={header.id}
              className="relative flex items-center px-2 py-1 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-accent"
              style={{ width: header.getSize(), minWidth: header.column.columnDef.minSize }}
              onClick={header.column.getToggleSortingHandler()}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {header.column.getIsSorted() === 'asc' && <ArrowUp size={12} className="ml-1" />}
              {header.column.getIsSorted() === 'desc' && <ArrowDown size={12} className="ml-1" />}

              {/* Resize handle */}
              <div
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
              />
            </div>
          )),
        )}
      </div>

      {/* Body */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const isSelected = selectedIds.has(row.original.id);

            return (
              <div
                key={row.id}
                className={`absolute flex items-center w-full text-xs cursor-default border-b border-border/50 ${
                  isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'
                } ${row.original.error > 0 ? 'text-red-500' : ''}`}
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={(e) => handleRowClick(row.original.id, e)}
                onContextMenu={(e) => handleContextMenu(row.original.id, e)}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="px-2 truncate"
                    style={{ width: cell.column.getSize(), minWidth: cell.column.columnDef.minSize }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {torrents.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            {t('app.noTorrents')}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <TorrentContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          torrentIds={contextMenu.ids}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
