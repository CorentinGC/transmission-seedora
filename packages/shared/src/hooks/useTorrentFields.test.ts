import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformApi } from '../platform/api-types';
import { bumpServerEpoch } from '../lib/server-epoch';
import {
  fetchTorrentFields,
  fieldsReducer,
  loadTorrentFields,
  type FieldsAction,
  type FieldsState,
} from './useTorrentFields';

vi.mock('i18next', () => ({ default: { t: (key: string) => key } }));

const apiWith = (rpcTorrentGet: unknown) => ({ rpcTorrentGet }) as unknown as Pick<PlatformApi, 'rpcTorrentGet'>;

describe('fetchTorrentFields', () => {
  it('returns the first torrent of a successful response', async () => {
    const get = vi.fn().mockResolvedValue({ success: true, data: { torrents: [{ id: 3, peers: [] }] } });
    expect(await fetchTorrentFields<{ id: number }>(apiWith(get), ['peers'], 3)).toEqual({ id: 3, peers: [] });
    expect(get).toHaveBeenCalledWith(['peers'], [3]);
  });

  it('throws the platform error text on success:false', async () => {
    const get = vi.fn().mockResolvedValue({ success: false, error: 'daemon down' });
    await expect(fetchTorrentFields(apiWith(get), ['peers'], 3)).rejects.toThrow('daemon down');
  });

  it('throws a translated fallback when success:false carries no text', async () => {
    const get = vi.fn().mockResolvedValue({ success: false });
    await expect(fetchTorrentFields(apiWith(get), ['peers'], 3)).rejects.toThrow('details.requestFailed');
  });

  it('throws when the torrent is missing from the response', async () => {
    const get = vi.fn().mockResolvedValue({ success: true, data: { torrents: [] } });
    await expect(fetchTorrentFields(apiWith(get), ['peers'], 3)).rejects.toThrow('details.torrentNotFound');
  });
});

type S = FieldsState<{ n: number }>;
const state = (over: Partial<S> = {}): S => ({ torrentId: 1, data: null, error: null, ...over });

describe('fieldsReducer', () => {
  it('resets data and error when switching torrent, keeps state for the same torrent', () => {
    const s = state({ data: { n: 1 }, error: 'x' });
    expect(fieldsReducer(s, { type: 'switch', torrentId: 2 })).toEqual({ torrentId: 2, data: null, error: null });
    expect(fieldsReducer(s, { type: 'switch', torrentId: 1 })).toBe(s);
  });

  it('drops a stale response issued for the previous torrent', () => {
    const s = state({ torrentId: 2 });
    expect(fieldsReducer(s, { type: 'loaded', torrentId: 1, data: { n: 9 } })).toBe(s);
    expect(fieldsReducer(s, { type: 'failed', torrentId: 1, error: 'late' })).toBe(s);
  });

  it('keeps the last data on failure and clears the error on the next success', () => {
    let s = fieldsReducer(state(), { type: 'loaded', torrentId: 1, data: { n: 1 } });
    s = fieldsReducer(s, { type: 'failed', torrentId: 1, error: 'down' });
    expect(s).toEqual({ torrentId: 1, data: { n: 1 }, error: 'down' });
    s = fieldsReducer(s, { type: 'loaded', torrentId: 1, data: { n: 2 } });
    expect(s).toEqual({ torrentId: 1, data: { n: 2 }, error: null });
  });

  it('ignores a mutation issued for another torrent or before data exists', () => {
    const update = vi.fn((p: { n: number }) => ({ n: p.n + 1 }));
    const s = state({ torrentId: 2, data: { n: 1 } });
    expect(fieldsReducer(s, { type: 'mutate', torrentId: 1, update })).toBe(s);
    expect(update).not.toHaveBeenCalled();
    const empty = state();
    expect(fieldsReducer(empty, { type: 'mutate', torrentId: 1, update })).toBe(empty);
    expect(fieldsReducer(s, { type: 'mutate', torrentId: 2, update }).data).toEqual({ n: 2 });
  });
});

describe('loadTorrentFields', () => {
  afterEach(() => vi.restoreAllMocks());

  const deferred = () => {
    let resolve!: (v: unknown) => void;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  };

  it('dispatches loaded data', async () => {
    const get = vi.fn().mockResolvedValue({ success: true, data: { torrents: [{ n: 1 }] } });
    const dispatch = vi.fn();
    expect(await loadTorrentFields(apiWith(get), ['n'], 4, dispatch, () => false)).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({ type: 'loaded', torrentId: 4, data: { n: 1 } });
  });

  it('dispatches nothing when cancelled while the request is in flight (torrent switched)', async () => {
    const d = deferred();
    const dispatch = vi.fn();
    let cancelled = false;
    const run = loadTorrentFields(apiWith(() => d.promise), ['n'], 4, dispatch, () => cancelled);
    cancelled = true;
    d.resolve({ success: true, data: { torrents: [{ n: 1 }] } });
    expect(await run).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('discards a response, success or failure, that arrives after a server switch', async () => {
    const ok = deferred();
    const dispatch = vi.fn();
    const run = loadTorrentFields(apiWith(() => ok.promise), ['n'], 4, dispatch, () => false);
    bumpServerEpoch();
    ok.resolve({ success: true, data: { torrents: [{ n: 1 }] } });
    expect(await run).toBe(false);

    const bad = deferred();
    const run2 = loadTorrentFields(apiWith(() => bad.promise), ['n'], 4, dispatch, () => false);
    bumpServerEpoch();
    bad.resolve({ success: false, error: 'old server' });
    expect(await run2).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('reports a failure as a failed action', async () => {
    const dispatch = vi.fn<(a: FieldsAction<unknown>) => void>();
    const get = vi.fn().mockResolvedValue({ success: false, error: 'daemon down' });
    expect(await loadTorrentFields(apiWith(get), ['n'], 4, dispatch, () => false)).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({ type: 'failed', torrentId: 4, error: 'daemon down' });
  });
});
