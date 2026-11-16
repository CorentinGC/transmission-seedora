import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initPlatformApi } from '../platform/api-store';
import type { PlatformApi } from '../platform/api-types';
import { bumpServerEpoch } from '../lib/server-epoch';
import { useNotificationStore } from './notification-store';
import { useTorrentStore } from './torrent-store';

const api = {
  rpcTorrentGet: vi.fn(),
  rpcTorrentStart: vi.fn(),
  rpcTorrentStop: vi.fn(),
  rpcTorrentRemove: vi.fn(),
  rpcTorrentSet: vi.fn(),
  rpcQueueMoveTop: vi.fn(),
  rpcTorrentSetLocation: vi.fn(),
};

const torrent = (id: number) => ({ id, name: `t${id}` });
const keys = () => useNotificationStore.getState().notifications.map((n) => n.messageKey);

describe('torrent store failure handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    initPlatformApi(api as unknown as PlatformApi);
    useTorrentStore.getState().reset();
    useNotificationStore.setState({ notifications: [] });
  });

  it('notifies and skips the refresh when an action returns success:false', async () => {
    api.rpcTorrentStart.mockResolvedValue({ success: false, error: 'permission denied' });

    await useTorrentStore.getState().startTorrents([1]);

    expect(keys()).toEqual(['notification.actionFailed']);
    expect(useNotificationStore.getState().notifications[0]?.params).toEqual({ error: 'permission denied' });
    expect(api.rpcTorrentGet).not.toHaveBeenCalled();
  });

  it('notifies when an action throws', async () => {
    api.rpcTorrentStop.mockRejectedValue(new Error('boom'));

    await useTorrentStore.getState().stopTorrents([1]);

    expect(keys()).toEqual(['notification.actionFailed']);
  });

  it('keeps the torrent and selection when a removal fails', async () => {
    useTorrentStore.setState({ torrents: new Map([[1, torrent(1) as never]]), selectedIds: new Set([1]) });
    api.rpcTorrentRemove.mockResolvedValue({ success: false, error: 'nope' });

    await useTorrentStore.getState().removeTorrents([1], false);

    expect(useTorrentStore.getState().torrents.has(1)).toBe(true);
    expect(useTorrentStore.getState().selectedIds.has(1)).toBe(true);
    expect(keys()).toEqual(['notification.actionFailed']);
  });

  it('removes the torrent locally when the removal succeeds', async () => {
    useTorrentStore.setState({ torrents: new Map([[1, torrent(1) as never]]), selectedIds: new Set([1]) });
    api.rpcTorrentRemove.mockResolvedValue({ success: true });

    await useTorrentStore.getState().removeTorrents([1], false);

    expect(useTorrentStore.getState().torrents.has(1)).toBe(false);
    expect(keys()).toEqual([]);
  });

  it('setTorrentProps reports success to its caller', async () => {
    api.rpcTorrentSet.mockResolvedValueOnce({ success: false, error: 'x' });
    expect(await useTorrentStore.getState().setTorrentProps([1], {})).toBe(false);

    api.rpcTorrentSet.mockResolvedValueOnce({ success: true });
    api.rpcTorrentGet.mockResolvedValue({ success: true, data: { torrents: [] } });
    expect(await useTorrentStore.getState().setTorrentProps([1], {})).toBe(true);
  });

  it('removeTorrents and moveTorrents report success to their caller', async () => {
    api.rpcTorrentRemove.mockResolvedValueOnce({ success: false, error: 'x' });
    expect(await useTorrentStore.getState().removeTorrents([1], false)).toBe(false);
    api.rpcTorrentSetLocation.mockResolvedValueOnce({ success: false, error: 'x' });
    expect(await useTorrentStore.getState().moveTorrents([1], '/d', true)).toBe(false);

    api.rpcTorrentRemove.mockResolvedValueOnce({ success: true });
    expect(await useTorrentStore.getState().removeTorrents([1], false)).toBe(true);
    api.rpcTorrentSetLocation.mockResolvedValueOnce({ success: true });
    api.rpcTorrentGet.mockResolvedValue({ success: true, data: { torrents: [] } });
    expect(await useTorrentStore.getState().moveTorrents([1], '/d', true)).toBe(true);
  });

  it('queueMove surfaces a failed move', async () => {
    api.rpcQueueMoveTop.mockResolvedValue({ success: false, error: 'bad' });

    await useTorrentStore.getState().queueMove([1], 'top');

    expect(keys()).toEqual(['notification.actionFailed']);
  });

  it('falls back to a full fetch when the recently-active fetch fails', async () => {
    api.rpcTorrentGet
      .mockResolvedValueOnce({ success: false, error: 'rpc down' })
      .mockResolvedValueOnce({ success: true, data: { torrents: [torrent(7)] } });

    await useTorrentStore.getState().fetchRecentlyActive();

    expect(api.rpcTorrentGet).toHaveBeenCalledTimes(2);
    expect(useTorrentStore.getState().torrents.has(7)).toBe(true);
  });

  it('reports a failing refresh once until it recovers', async () => {
    api.rpcTorrentGet.mockResolvedValue({ success: false, error: 'down' });
    await useTorrentStore.getState().fetchTorrents();
    const [firstNotification] = useNotificationStore.getState().notifications;
    if (!firstNotification) throw new Error('expected a failure notification');
    useNotificationStore.getState().dismiss(firstNotification.id);
    await useTorrentStore.getState().fetchTorrents();
    expect(keys()).toEqual([]);

    api.rpcTorrentGet.mockResolvedValue({ success: true, data: { torrents: [] } });
    await useTorrentStore.getState().fetchTorrents();
    api.rpcTorrentGet.mockResolvedValue({ success: false, error: 'down again' });
    await useTorrentStore.getState().fetchTorrents();
    expect(keys()).toEqual(['notification.refreshFailed']);
  });

  it('discards a response that arrives after the server changed', async () => {
    let resolve!: (v: unknown) => void;
    api.rpcTorrentGet.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const pending = useTorrentStore.getState().fetchTorrents();
    bumpServerEpoch();
    resolve({ success: true, data: { torrents: [torrent(99)] } });
    await pending;

    expect(useTorrentStore.getState().torrents.size).toBe(0);
  });

  it('discards a stale recently-active response too', async () => {
    let resolve!: (v: unknown) => void;
    api.rpcTorrentGet.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const pending = useTorrentStore.getState().fetchRecentlyActive();
    bumpServerEpoch();
    resolve({ success: true, data: { torrents: [torrent(99)] } });
    await pending;

    expect(useTorrentStore.getState().torrents.size).toBe(0);
  });
});
