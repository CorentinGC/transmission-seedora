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
});
