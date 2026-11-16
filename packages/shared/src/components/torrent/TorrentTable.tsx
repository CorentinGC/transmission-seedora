import { useMemo, useCallback, useId, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTorrentStore } from '../../stores/torrent-store';
import { useUiStore } from '../../stores/ui-store';
import { createTorrentColumns, DEFAULT_VISIBLE_COLUMNS } from './TorrentColumns';
import { TorrentContextMenu } from './TorrentContextMenu';
import { HeaderContextMenu } from './HeaderContextMenu';
import type { Torrent } from '../../types/torrent';
import { ArrowUp, ArrowDown, Columns3 } from 'lucide-react';
import { useGridNavigation } from './useGridNavigation';
import { useHeaderKeyboard } from './useHeaderKeyboard';
import { fitColumnWidth, measureContentWidth } from './column-utils';
import { FOCUS_FALLBACK_ATTRIBUTE } from '../ui/popup';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { TorrentCardList } from './TorrentCardList';
import { COMPACT_LIST_QUERY } from './card-model';

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

  const compact = useMediaQuery(COMPACT_LIST_QUERY);
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
    const allColIds = columns.map(
      (c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id ?? '',
    );
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

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent, columnId: string) => {
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
    },
    [cancelLongPress],
  );

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
      setTimeout(() => {
        suppressClick.current = false;
      }, 50);
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

  const handleResizeDoubleClick = useCallback(
    (columnId: string, headerIndex: number) => {
      const bodyContainer = parentRef.current;
      if (!bodyContainer) return;
      const sources: HTMLElement[] = [];
      const headerEl = headerRefs.current.get(columnId);
      if (headerEl) sources.push(headerEl);
      bodyContainer.querySelectorAll(':scope > div > div').forEach((row) => {
        const cell = row.children[headerIndex];
        if (cell instanceof HTMLElement) sources.push(cell);
      });
      const minSize = table.getColumn(columnId)?.columnDef.minSize ?? 40;
      setColumnSizing({ ...columnSizing, [columnId]: fitColumnWidth(measureContentWidth(sources), minSize) });
    },
    [columnSizing, setColumnSizing, table],
  );

  const gridId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const [headerTabId, setHeaderTabId] = useState<string | null>(null);
  const visibleColumnIds = table.getVisibleLeafColumns().map((c) => c.id);
  const rowDomId = (id: number) => `${gridId}-r${id}`;
  const cellDomId = (id: number, columnIndex: number) => `${rowDomId(id)}-c${columnIndex}`;

  const openRowMenu = useCallback(
    (id: number) => {
      const rect = (document.getElementById(rowDomId(id)) ?? gridRef.current)?.getBoundingClientRect();
      if (!selectedIds.has(id)) selectTorrent(id);
      setContextMenu({
        x: (rect?.left ?? 0) + 32,
        y: rect?.bottom ?? 0,
        ids: selectedIds.has(id) ? Array.from(selectedIds) : [id],
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rowDomId only reads gridId
    [selectedIds, selectTorrent, gridId],
  );

  const nav = useGridNavigation({
    rowIds: allVisibleIds,
    selectedIds,
    select: selectTorrent,
    toggle: toggleTorrent,
    extendTo: (id) => selectRange(id, allVisibleIds),
    scrollToIndex: (index) => virtualizer.scrollToIndex(index),
    openMenu: openRowMenu,
  });

  const virtualItems = virtualizer.getVirtualItems();
  // Only a rendered row can be an active descendant; the id points at its first gridcell.
  const activeRowRendered =
    nav.activeId !== null && virtualItems.some((v) => rows[v.index]?.original.id === nav.activeId);
  const activeDescendant =
    nav.focused && nav.activeId !== null && activeRowRendered ? cellDomId(nav.activeId, 0) : undefined;

  const openColumnsMenuAt = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setHeaderMenu({ x: rect.left, y: rect.bottom });
  };

  const handleHeaderKeyDown = useHeaderKeyboard({
    headerRowRef,
    visibleColumnIds,
    columnOrder: effectiveColumnOrder,
    columnSizing,
    setColumnOrder,
    setColumnSizing,
    openColumnsMenuAt,
  });

  const syncScroll = (from: HTMLElement, to: HTMLElement | null) => {
    if (to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
  };

  const openMenuAt = (id: number, x: number, y: number) => {
    if (!selectedIds.has(id)) selectTorrent(id);
    setContextMenu({ x, y, ids: selectedIds.has(id) ? Array.from(selectedIds) : [id] });
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {compact ? (
        <TorrentCardList
          torrents={rows.map((r) => r.original)}
          selectedIds={selectedIds}
          onRowClick={handleRowClick}
          select={selectTorrent}
          toggle={toggleTorrent}
          extendTo={(id) => selectRange(id, allVisibleIds)}
          onMenu={openMenuAt}
        />
      ) : (
        <div
          ref={gridRef}
          role="grid"
          aria-label={t('app.torrentList')}
          aria-rowcount={rows.length + 1}
          aria-multiselectable="true"
          aria-activedescendant={activeDescendant}
          {...{ [FOCUS_FALLBACK_ATTRIBUTE]: '' }}
          tabIndex={0}
          onKeyDown={nav.onKeyDown}
          onFocus={nav.onFocus}
          onBlur={nav.onBlur}
          className="flex min-h-0 flex-1 flex-col focus:outline-none"
        >
          {/* Header */}
          <div
            role="rowgroup"
            ref={headerScrollRef}
            className="overflow-hidden"
            onScroll={(e) => syncScroll(e.currentTarget, parentRef.current)}
          >
            {/* The header context menu has keyboard equivalents (ContextMenu key on a header, the columns button). */}
            {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- focus lives on the column headers inside */}
            <div
              role="row"
              aria-rowindex={1}
              ref={headerRowRef}
              className="flex border-b bg-muted/50 select-none"
              style={{ minWidth: table.getTotalSize() }}
              onContextMenu={(e) => {
                e.preventDefault();
                setHeaderMenu({ x: e.clientX, y: e.clientY });
              }}
            >
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <div
                      key={header.id}
                      role="columnheader"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      tabIndex={(headerTabId ?? visibleColumnIds[0]) === header.column.id ? 0 : -1}
                      ref={(el) => {
                        if (el) headerRefs.current.set(header.column.id, el);
                        else headerRefs.current.delete(header.column.id);
                      }}
                      className={`relative flex items-center px-2 py-1 pointer-coarse:py-3 text-xs font-medium text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
                        dragColumnId === header.column.id ? 'opacity-40 bg-accent' : ''
                      } ${dropTargetId === header.column.id ? 'border-l-2 border-info' : ''} ${
                        dragColumnId ? 'cursor-grabbing' : 'cursor-pointer'
                      }`}
                      style={{ width: header.getSize(), minWidth: header.column.columnDef.minSize }}
                      onClick={(e) => handleHeaderClick(e, header.column.getToggleSortingHandler())}
                      onKeyDown={(e) => handleHeaderKeyDown(e, header)}
                      onFocus={() => setHeaderTabId(header.column.id)}
                      onMouseDown={(e) => handleHeaderMouseDown(e, header.column.id)}
                      onMouseUp={handleHeaderMouseUp}
                      onMouseLeave={cancelLongPress}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === 'asc' && <ArrowUp size={12} className="ml-1" aria-hidden="true" />}
                      {sorted === 'desc' && <ArrowDown size={12} className="ml-1" aria-hidden="true" />}

                      {/* Resize handle (pointer only; keyboard: Shift+Left/Right on the header) */}
                      <div
                        role="presentation"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleResizeDoubleClick(header.column.id, header.index);
                        }}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-info"
                      />
                    </div>
                  );
                }),
              )}
              <div role="columnheader" className="sticky right-0 ml-auto flex items-center bg-muted">
                <button
                  type="button"
                  aria-label={t('columnMenu.setupColumns')}
                  aria-haspopup="dialog"
                  onClick={(e) => openColumnsMenuAt(e.currentTarget)}
                  className="inline-flex h-full items-center px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground pointer-coarse:min-w-11 pointer-coarse:justify-center"
                >
                  <Columns3 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div
            ref={parentRef}
            role="rowgroup"
            className="min-h-0 flex-1 overflow-auto select-none"
            onScroll={(e) => syncScroll(e.currentTarget, headerScrollRef.current)}
          >
            <div
              role="presentation"
              style={{ height: virtualizer.getTotalSize(), minWidth: table.getTotalSize(), position: 'relative' }}
            >
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                const isSelected = selectedIds.has(row.original.id);
                const isActive = nav.focused && nav.activeId === row.original.id;

                return (
                  // Pointer shortcuts only: the grid owns keyboard focus and handles every row key (useGridNavigation).
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
                  <div
                    key={row.id}
                    id={rowDomId(row.original.id)}
                    role="row"
                    aria-rowindex={virtualRow.index + 2}
                    aria-selected={isSelected}
                    className={`absolute flex items-center w-full text-xs cursor-default border-b border-border/50 ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'
                    } ${isActive ? 'outline-2 -outline-offset-2 outline-ring' : ''} ${row.original.error > 0 ? 'text-destructive-text' : ''}`}
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={(e) => {
                      nav.setActiveId(row.original.id);
                      handleRowClick(row.original.id, e);
                    }}
                    onContextMenu={(e) => handleContextMenu(row.original.id, e)}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => (
                      <div
                        key={cell.id}
                        id={cellIndex === 0 ? cellDomId(row.original.id, 0) : undefined}
                        role="gridcell"
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
        </div>
      )}

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
