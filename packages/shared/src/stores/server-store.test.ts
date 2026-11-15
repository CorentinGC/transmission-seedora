import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initPlatformApi } from '../platform/api-store';
import type { PlatformApi } from '../platform/api-types';
import { useServerStore } from './server-store';

const api = {
  serverSetActive: vi.fn(),
  rpcSessionGet: vi.fn(),
};

describe('server store setActiveServer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    initPlatformApi(api as unknown as PlatformApi);
    useServerStore.setState({ activeServerId: null, connectionStatus: 'disconnected', connectionError: null });
  });

  it('surfaces a failed serverSetActive as an error status', async () => {
    api.serverSetActive.mockResolvedValue({ success: false, error: 'Too many requests' });

    await useServerStore.getState().setActiveServer('srv-1');

    const state = useServerStore.getState();
    expect(state.connectionStatus).toBe('error');
    expect(state.connectionError).toBe('Too many requests');
    expect(state.activeServerId).toBeNull();
    expect(api.rpcSessionGet).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the failure has no error text', async () => {
    api.serverSetActive.mockResolvedValue({ success: false });

    await useServerStore.getState().setActiveServer('srv-1');

    expect(useServerStore.getState().connectionStatus).toBe('error');
    expect(useServerStore.getState().connectionError).toBe('Connection failed');
  });

  it('connects when serverSetActive and the session probe succeed', async () => {
    api.serverSetActive.mockResolvedValue({ success: true });
    api.rpcSessionGet.mockResolvedValue({ success: true });

    await useServerStore.getState().setActiveServer('srv-1');

    expect(useServerStore.getState().connectionStatus).toBe('connected');
    expect(useServerStore.getState().activeServerId).toBe('srv-1');
  });

  it('ignores a stale activation that settles after a newer one started', async () => {
    let resolveFirst!: (v: unknown) => void;
    api.serverSetActive
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce({ success: true });
    api.rpcSessionGet.mockResolvedValue({ success: true });

    const first = useServerStore.getState().setActiveServer('srv-old');
    await useServerStore.getState().setActiveServer('srv-new');
    resolveFirst({ success: true });
    await first;

    const state = useServerStore.getState();
    expect(state.activeServerId).toBe('srv-new');
    expect(state.connectionStatus).toBe('connected');
  });

  it('ignores a stale activation failure after a newer one succeeded', async () => {
    let rejectFirst!: (v: unknown) => void;
    api.serverSetActive
      .mockReturnValueOnce(new Promise((r) => { rejectFirst = r; }))
      .mockResolvedValueOnce({ success: true });
    api.rpcSessionGet.mockResolvedValue({ success: true });

    const first = useServerStore.getState().setActiveServer('srv-old');
    await useServerStore.getState().setActiveServer('srv-new');
    rejectFirst({ success: false, error: 'timeout' });
    await first;

    expect(useServerStore.getState().connectionStatus).toBe('connected');
    expect(useServerStore.getState().connectionError).toBeNull();
  });

  it('ignores a stale session probe result', async () => {
    let resolveProbe!: (v: unknown) => void;
    api.serverSetActive.mockResolvedValue({ success: true });
    api.rpcSessionGet
      .mockReturnValueOnce(new Promise((r) => { resolveProbe = r; }))
      .mockResolvedValueOnce({ success: true });

    const first = useServerStore.getState().setActiveServer('srv-old');
    await Promise.resolve();
    await useServerStore.getState().setActiveServer('srv-new');
    resolveProbe({ success: false, error: 'old server down' });
    await first;

    expect(useServerStore.getState().connectionStatus).toBe('connected');
    expect(useServerStore.getState().activeServerId).toBe('srv-new');
  });

  it('turns a thrown serverSetActive into an error status', async () => {
    api.serverSetActive.mockRejectedValue(new Error('ipc closed'));

    await useServerStore.getState().setActiveServer('srv-1');

    expect(useServerStore.getState().connectionStatus).toBe('error');
    expect(useServerStore.getState().connectionError).toBe('ipc closed');
  });
});
