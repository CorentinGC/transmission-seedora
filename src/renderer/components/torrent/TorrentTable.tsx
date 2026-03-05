import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
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
import { HeaderContextMenu } from './HeaderContextMenu';
import type { Torrent } from '../../types/torrent';
import { ArrowUp, ArrowDown } from 'lucide-react';

const LONG_PRESS_MS = 500;

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
  const columnOrder = useUiStore((s) => s.columnOrder);
  const setColumnSizing = useUiStore((s) => s.setColumnSizing);
  const setColumnVisibility = useUiStore((s) => s.setColumnVisibility);
  const setColumnOrder = useUiStore((s) => s.setColumnOrder);
  const relativeDates = useUiStore((s) => s.relativeDates);

  const columns = useMemo(() => createTorrentColumns(relativeDates, t), [relativeDates, t]);

  const parentRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ids: number[] } | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const effectiveVisibility = useMemo(
    () => (Object.keys(columnVisibility).length > 0 ? columnVisibility : DEFAULT_VISIBLE_COLUMNS),
    [columnVisibility],
  );

  // Build effective column order: use saved order if it exists, otherwise use definition order
  const effectiveColumnOrder = useMemo(() => {
    const allColIds = columns.map((c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id ?? '');
    if (columnOrder.length > 0) {
      // Merge: saved order first (filtering removed cols), then any new cols not in saved order
      const ordered = columnOrder.filter((id) => allColIds.includes(id));
      const newCols = allColIds.filter((id) => !columnOrder.includes(id));
      return [...ordered, ...newCols];
    }
    return allColIds;
  }, [columnOrder, columns]);

  const table = useReactTable({
    data: torrents,
    columns: columns as ColumnDef<Torrent, unknown>[],
    state: {
      sorting: sortingState,
      columnVisibility: effectiveVisibility,
      columnSizing,
      columnOrder: effectiveColumnOrder,
    },
    onSortingChange: setSortingState,
    onColumnSizingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnSizing) : updater;
      setColumnSizing(next);
    },
    onColumnOrderChange: (updater) => {
      const next = typeof updater === 'function' ? updater(effectiveColumnOrder) : updater;
      setColumnOrder(next);
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

  // Long-press column reorder: mousedown starts a timer, after LONG_PRESS_MS we enter drag mode
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const headerRowRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnId: string) => {
    // Don't start long-press if clicking on the resize handle area (right 6px)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX > rect.right - 6) return;
    // Only left button
    if (e.button !== 0) return;

    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setDragColumnId(columnId);
      suppressClick.current = true;
    }, LONG_PRESS_MS);
  }, [cancelLongPress]);

  const handleHeaderMouseUp = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  // When in drag mode, track mouse over headers to find drop target, and drop on mouseup
  useEffect(() => {
    if (!dragColumnId) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Find which header the mouse is over
      let found: string | null = null;
      for (const [colId, el] of headerRefs.current) {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          if (colId !== dragColumnId) found = colId;
          break;
        }
      }
      setDropTargetId(found);
    };

    const handleMouseUp = () => {
      if (dropTargetId && dragColumnId !== dropTargetId) {
        const currentOrder = [...effectiveColumnOrder];
        const fromIndex = currentOrder.indexOf(dragColumnId);
        const toIndex = currentOrder.indexOf(dropTargetId);
        if (fromIndex !== -1 && toIndex !== -1) {
          currentOrder.splice(fromIndex, 1);
          currentOrder.splice(toIndex, 0, dragColumnId);
          setColumnOrder(currentOrder);
        }
      }
      setDragColumnId(null);
      setDropTargetId(null);
      // Suppress the click event that follows mouseup so sorting doesn't trigger
      setTimeout(() => { suppressClick.current = false; }, 50);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragColumnId, dropTargetId, effectiveColumnOrder, setColumnOrder]);

  const handleHeaderClick = useCallback((e: React.MouseEvent, toggleSort: ((e: unknown) => void) | undefined) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    toggleSort?.(e);
  }, []);

  const handleResizeDoubleClick = useCallback((columnId: string, headerIndex: number) => {
    const bodyContainer = parentRef.current;
    if (!bodyContainer) return;

    // Create off-screen measurement container
    const measure = document.createElement('div');
    measure.style.cssText = 'position:absolute;top:-9999px;left:-9999px;white-space:nowrap;visibility:hidden;';
    document.body.appendChild(measure);

    // Measure header
    const headerEl = headerRefs.current.get(columnId);
    let maxWidth = 0;
    if (headerEl) {
      measure.className = headerEl.className;
      measure.style.width = 'auto';
      measure.style.position = 'absolute';
      measure.style.visibility = 'hidden';
      measure.style.whiteSpace = 'nowrap';
      measure.innerHTML = headerEl.innerHTML;
      maxWidth = measure.offsetWidth;
    }

    // Measure body cells
    const rows = bodyContainer.querySelectorAll(':scope > div > div');
    rows.forEach((row) => {
      const cell = row.children[headerIndex] as HTMLElement | undefined;
      if (cell) {
        measure.className = cell.className;
        measure.style.width = 'auto';
        measure.style.position = 'absolute';
        measure.style.visibility = 'hidden';
        measure.style.whiteSpace = 'nowrap';
        measure.innerHTML = cell.innerHTML;
        maxWidth = Math.max(maxWidth, measure.offsetWidth);
      }
    });

    document.body.removeChild(measure);

    const col = table.getColumn(columnId);
    const minSize = col?.columnDef.minSize ?? 40;
    // Add 2px buffer to avoid sub-pixel rounding issues
    const newWidth = Math.max(maxWidth + 2, minSize);

    setColumnSizing({ ...columnSizing, [columnId]: newWidth });
  }, [columnSizing, setColumnSizing, table]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div ref={headerRowRef} className="flex border-b bg-muted/50 select-none" onContextMenu={(e) => { e.preventDefault(); setHeaderMenu({ x: e.clientX, y: e.clientY }); }}>
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div
              key={header.id}
              ref={(el) => { if (el) headerRefs.current.set(header.column.id, el); else headerRefs.current.delete(header.column.id); }}
              className={`relative flex items-center px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent ${
                dragColumnId === header.column.id ? 'opacity-40 bg-accent' : ''
              } ${dropTargetId === header.column.id ? 'border-l-2 border-blue-500' : ''} ${
                dragColumnId ? 'cursor-grabbing' : 'cursor-pointer'
              }`}
              style={{ width: header.getSize(), minWidth: header.column.columnDef.minSize }}
              onClick={(e) => handleHeaderClick(e, header.column.getToggleSortingHandler())}
              onMouseDown={(e) => handleHeaderMouseDown(e, header.column.id)}
              onMouseUp={handleHeaderMouseUp}
              onMouseLeave={cancelLongPress}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {header.column.getIsSorted() === 'asc' && <ArrowUp size={12} className="ml-1" />}
              {header.column.getIsSorted() === 'desc' && <ArrowDown size={12} className="ml-1" />}

              {/* Resize handle */}
              <div
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => { e.stopPropagation(); handleResizeDoubleClick(header.column.id, header.index); }}
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
              />
            </div>
          )),
        )}
      </div>

      {/* Body */}
      <div ref={parentRef} className="flex-1 overflow-auto select-none">
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

      {/* Header context menu for column customization */}
      {headerMenu && (
        <HeaderContextMenu
          x={headerMenu.x}
          y={headerMenu.y}
          columns={table.getAllColumns()}
          visibility={effectiveVisibility}
          onToggle={(colId) => {
            const updated = { ...effectiveVisibility, [colId]: !effectiveVisibility[colId] };
            setColumnVisibility(updated);
          }}
          onClose={() => setHeaderMenu(null)}
        />
      )}
    </div>
  );
}
