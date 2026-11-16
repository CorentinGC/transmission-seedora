import { useEffect, useReducer, useRef } from 'react';
import i18n from 'i18next';
import { useApi } from '../platform/api-context';
import type { PlatformApi } from '../platform/api-types';
import { useUiStore } from '../stores/ui-store';
import { currentServerEpoch, isServerEpochCurrent } from '../lib/server-epoch';
import { startPolling } from './usePolling';

/**
 * Fetches `fields` of one torrent. Throws the platform error text on `success:false`
 * or when the torrent is absent from the response.
 */
export async function fetchTorrentFields<T>(
  api: Pick<PlatformApi, 'rpcTorrentGet'>,
  fields: string[],
  torrentId: number,
): Promise<T> {
  const res = await api.rpcTorrentGet(fields, [torrentId]);
  if (!res.success) throw new Error(res.error ?? i18n.t('details.requestFailed'));
  const torrents = (res.data as { torrents?: T[] } | undefined)?.torrents;
  const torrent = torrents?.[0];
  if (!torrent) throw new Error(i18n.t('details.torrentNotFound'));
  return torrent;
}

/** State of one details tab: always tagged with the torrent it belongs to. */
export interface FieldsState<T> {
  torrentId: number;
  data: T | null;
  error: string | null;
}

export type FieldsAction<T> =
  | { type: 'switch'; torrentId: number }
  | { type: 'loaded'; torrentId: number; data: T }
  | { type: 'failed'; torrentId: number; error: string }
  | { type: 'mutate'; torrentId: number; update: (prev: T) => T };

/**
 * Pure transitions of `useTorrentFields`. Every action carries the torrent it was
 * issued for, and an action for another torrent than the current one is dropped, so a
 * response still in flight after a torrent switch can never overwrite the new tab.
 * A failure keeps the last data; the next success clears the error.
 */
export function fieldsReducer<T>(state: FieldsState<T>, action: FieldsAction<T>): FieldsState<T> {
  if (action.type === 'switch') {
    return state.torrentId === action.torrentId ? state : { torrentId: action.torrentId, data: null, error: null };
  }
  if (action.torrentId !== state.torrentId) return state;
  switch (action.type) {
    case 'loaded':
      return { ...state, data: action.data, error: null };
    case 'failed':
      return { ...state, error: action.error };
    case 'mutate':
      return state.data ? { ...state, data: action.update(state.data) } : state;
  }
}

/**
 * One load of `fields`: dispatches the result unless the server session changed while
 * the request was in flight (the response then belongs to a previous server) or the
 * caller was cancelled. Resolves true when data was loaded and applied.
 */
export async function loadTorrentFields<T>(
  api: Pick<PlatformApi, 'rpcTorrentGet'>,
  fields: string[],
  torrentId: number,
  dispatch: (action: FieldsAction<T>) => void,
  isCancelled: () => boolean,
): Promise<boolean> {
  const epoch = currentServerEpoch();
  try {
    const data = await fetchTorrentFields<T>(api, fields, torrentId);
    if (isCancelled() || !isServerEpochCurrent(epoch)) return false;
    dispatch({ type: 'loaded', torrentId, data });
    return true;
  } catch (err) {
    if (isCancelled() || !isServerEpochCurrent(epoch)) return false;
    dispatch({
      type: 'failed',
      torrentId,
      error: err instanceof Error ? err.message : i18n.t('details.requestFailed'),
    });
    return false;
  }
}

interface TorrentFields<T> {
  /** Latest data for the current torrent, null until the first successful load. */
  data: T | null;
  /** Error of the latest failed load, cleared by the next success. */
  error: string | null;
  /** Applies a local (optimistic) change to the loaded data. */
  mutate: (update: (prev: T) => T) => void;
  /** Fetches again now, outside the periodic refresh. */
  refresh: () => Promise<void>;
}

interface Options {
  /** Fetch until the first success, then stop polling (for data that never changes, e.g. file names). */
  once?: boolean;
}

/**
 * Loads and periodically refreshes `fields` of a torrent for a details tab.
 * Polling follows the user's polling interval, restarts when the torrent changes,
 * and is torn down on unmount; responses for a previous torrent or server are discarded.
 */
export function useTorrentFields<T>(
  torrentId: number,
  fields: readonly string[],
  { once = false }: Options = {},
): TorrentFields<T> {
  const api = useApi();
  const pollingInterval = useUiStore((s) => s.pollingInterval);
  const [state, dispatch] = useReducer(fieldsReducer<T>, { torrentId, data: null, error: null });
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const fieldKey = fields.join(',');

  useEffect(() => {
    let cancelled = false;
    let stop = () => {};
    dispatch({ type: 'switch', torrentId });

    const load = async () => {
      const loaded = await loadTorrentFields<T>(api, fieldKey.split(','), torrentId, dispatch, () => cancelled);
      if (loaded && once) stop();
    };
    refreshRef.current = () =>
      loadTorrentFields<T>(api, fieldKey.split(','), torrentId, dispatch, () => cancelled).then(() => {});

    // `load` surfaces its own errors in state, so the poller never sees a rejection.
    stop = startPolling(load, pollingInterval, () => {});
    return () => {
      cancelled = true;
      stop();
    };
  }, [api, torrentId, fieldKey, pollingInterval, once]);

  const current = state.torrentId === torrentId;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    mutate: (update) => dispatch({ type: 'mutate', torrentId, update }),
    refresh: () => refreshRef.current(),
  };
}
