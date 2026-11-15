import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initPlatformApi } from '../platform/api-store';
import type { PlatformApi } from '../platform/api-types';
import { bumpServerEpoch } from '../lib/server-epoch';
import { useNotificationStore } from './notification-store';
import { useSessionStore } from './session-store';

const api = { rpcSessionGet: vi.fn(), rpcSessionSet: vi.fn(), rpcSessionStats: vi.fn() };

describe('session store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    initPlatformApi(api as unknown as PlatformApi);
    useSessionStore.getState().reset();
    useNotificationStore.setState({ notifications: [] });
  });

  it('notifies when toggling alt speed fails and does not refetch', async () => {
    api.rpcSessionSet.mockResolvedValue({ success: false, error: 'denied' });

    await useSessionStore.getState().toggleAltSpeed();

    expect(useNotificationStore.getState().notifications.map((n) => n.messageKey)).toEqual([
      'notification.actionFailed',
    ]);
    expect(api.rpcSessionGet).not.toHaveBeenCalled();
  });

  it('discards settings that arrive after the server changed', async () => {
    let resolve!: (v: unknown) => void;
    api.rpcSessionGet.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const pending = useSessionStore.getState().fetchSettings();
    bumpServerEpoch();
    resolve({ success: true, data: { 'download-dir': '/old' } });
    await pending;

    expect(useSessionStore.getState().settings).toBeNull();
  });

  it('discards stats that arrive after the server changed', async () => {
    let resolve!: (v: unknown) => void;
    api.rpcSessionStats.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const pending = useSessionStore.getState().fetchStats();
    bumpServerEpoch();
    resolve({ success: true, data: { 'torrent-count': 3 } });
    await pending;

    expect(useSessionStore.getState().stats).toBeNull();
  });

  it('reports a failed or throwing refresh as an error text instead of rejecting', async () => {
    api.rpcSessionStats.mockResolvedValue({ success: false, error: 'daemon down' });
    expect(await useSessionStore.getState().fetchStats()).toBe('daemon down');

    api.rpcSessionGet.mockRejectedValue(new Error('network'));
    expect(await useSessionStore.getState().fetchSettings()).toBe('network');
  });

  it('resolves null on success', async () => {
    api.rpcSessionStats.mockResolvedValue({ success: true, data: { 'torrent-count': 3 } });
    expect(await useSessionStore.getState().fetchStats()).toBeNull();
  });
});
