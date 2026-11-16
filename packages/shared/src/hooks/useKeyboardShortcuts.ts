import { useEffect, useCallback } from 'react';
import { useTorrentStore } from '../stores/torrent-store';
import { useUiStore } from '../stores/ui-store';
import { useServerStore } from '../stores/server-store';

/** True when the key event target is a text-entry control that owns the keyboard. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as Partial<HTMLElement> | null;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true
  );
}

/** True when the key event target sits inside a modal dialog, which owns the keyboard. */
function isInsideDialog(target: EventTarget | null): boolean {
  const el = target as Partial<HTMLElement> | null;
  return typeof el?.closest === 'function' && el.closest('[role="dialog"]') !== null;
}

const INTERACTIVE_SELECTOR =
  'button, a[href], input, textarea, select, summary, [contenteditable=""], [contenteditable="true"], ' +
  '[role="button"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], ' +
  '[role="checkbox"], [role="option"], [role="gridcell"], [role="row"], [role="switch"], [role="radio"]';

/** True when the target is an interactive control or sits in an open dialog or menu: Space and Enter belong to it. */
export function ownsActivationKeys(target: EventTarget | null): boolean {
  const el = target as Partial<HTMLElement> | null;
  if (!el || typeof el.closest !== 'function') return false;
  if (isEditableTarget(target)) return true;
  return (
    el.closest(INTERACTIVE_SELECTOR) !== null || el.closest('[role="dialog"], [role="menu"], [role="listbox"]') !== null
  );
}

/**
 * Space key: toggles start/stop of the selection unless the focused element activates itself on Space.
 * Returns true when the event was handled.
 */
export function handleSpaceKey(
  e: Pick<KeyboardEvent, 'key' | 'target' | 'preventDefault'>,
  ids: number[],
  toggle: (ids: number[]) => void,
): boolean {
  if (e.key !== ' ' || ids.length === 0 || ownsActivationKeys(e.target)) return false;
  e.preventDefault();
  toggle(ids);
  return true;
}

/**
 * Delete key: opens the remove dialog when connected, focus is neither in an editable
 * control nor inside a dialog, and at least one torrent is selected.
 * Returns true when the event was handled.
 */
export function handleDeleteKey(
  e: Pick<KeyboardEvent, 'key' | 'target' | 'preventDefault'>,
  selectionSize: number,
  openRemoveDialog: () => void,
  connected: boolean,
): boolean {
  if (e.key !== 'Delete' || !connected || selectionSize === 0) return false;
  if (isEditableTarget(e.target) || isInsideDialog(e.target)) return false;
  e.preventDefault();
  openRemoveDialog();
  return true;
}

export function useKeyboardShortcuts(allVisibleIds: number[]) {
  const selectedIds = useTorrentStore((s) => s.selectedIds);
  const startTorrents = useTorrentStore((s) => s.startTorrents);
  const stopTorrents = useTorrentStore((s) => s.stopTorrents);
  const selectAll = useTorrentStore((s) => s.selectAll);
  const setGlobalFilter = useTorrentStore((s) => s.setGlobalFilter);
  const setStatusFilter = useTorrentStore((s) => s.setStatusFilter);
  const torrents = useTorrentStore((s) => s.torrents);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isInput = isEditableTarget(e.target);

      // Cmd/Ctrl+F: focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[data-search-input]');
        searchInput?.focus();
        return;
      }

      // Cmd/Ctrl+A: select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isInput) {
        e.preventDefault();
        selectAll(allVisibleIds);
        return;
      }

      // Don't handle other shortcuts when in input fields
      if (isInput) return;

      const connected = useServerStore.getState().connectionStatus === 'connected';
      if (handleDeleteKey(e, selectedIds.size, () => useUiStore.getState().setRemoveDialogOpen(true), connected))
        return;

      const ids = Array.from(selectedIds);

      // Space: toggle start/stop
      const toggle = (targets: number[]) => {
        const first = targets[0];
        if (first === undefined) return;
        if (torrents.get(first)?.status === 0) startTorrents(targets);
        else stopTorrents(targets);
      };
      if (handleSpaceKey(e, ids, toggle)) return;

      // Escape: clear search
      if (e.key === 'Escape') {
        setGlobalFilter('');
        (document.activeElement as HTMLElement)?.blur();
        return;
      }

      // Alt+1-8: status filters
      if (e.altKey && e.key >= '1' && e.key <= '8') {
        const filters = [
          'all',
          'downloading',
          'seeding',
          'completed',
          'active',
          'inactive',
          'stopped',
          'error',
        ] as const;
        const index = parseInt(e.key) - 1;
        const nextFilter = filters[index];
        if (nextFilter) setStatusFilter(nextFilter);
        return;
      }
    },
    [selectedIds, allVisibleIds, startTorrents, stopTorrents, selectAll, setGlobalFilter, setStatusFilter, torrents],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
