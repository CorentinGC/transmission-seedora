import i18n from 'i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initPlatformApi } from '../platform/api-store';
import type { PlatformApi } from '../platform/api-types';
import { useNotificationStore } from './notification-store';
import { useServerStore } from './server-store';

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    resources: { en: { translation: { notification: { unknownError: 'Unknown error' }, errors: { rpc: { NETWORK: 'Network error' } } } } },
  });
});

const api = {
  serverSetActive: vi.fn(),
  rpcSessionGet: vi.fn(),
  serverList: vi.fn(),
  serverAdd: vi.fn(),
  serverUpdate: vi.fn(),
  serverRemove: vi.fn(),
  serverTest: vi.fn(),
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
    expect(useServerStore.getState().connectionError).toBe('Unknown error');
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

const keys = () => useNotificationStore.getState().notifications.map((n) => n.messageKey);
const server = { id: 's1', name: 'One', host: 'h', port: 1 };

describe('server store CRUD failure handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    initPlatformApi(api as unknown as PlatformApi);
    useNotificationStore.setState({ notifications: [] });
    useServerStore.setState({
      servers: [server as never],
      activeServerId: null,
      connectionStatus: 'disconnected',
      connectionError: null,
    });
  });

  it('fetchServers notifies on failure and keeps the current list', async () => {
    api.serverList.mockResolvedValue({ success: false, error: 'boom' });
    await useServerStore.getState().fetchServers();
    expect(keys()).toEqual(['notification.serversLoadFailed']);
    expect(useServerStore.getState().servers).toHaveLength(1);
  });

  it('fetchServers notifies when the call throws', async () => {
    api.serverList.mockRejectedValue(new Error('ipc closed'));
    await useServerStore.getState().fetchServers();
    expect(keys()).toEqual(['notification.serversLoadFailed']);
  });

  it('addServer fails without touching the list or reloading it', async () => {
    api.serverAdd.mockResolvedValue({ success: false, error: 'invalid host' });
    expect(await useServerStore.getState().addServer({ name: 'x' } as never)).toEqual({ ok: false, reason: null });
    expect(useServerStore.getState().servers).toHaveLength(1);
    expect(api.serverList).not.toHaveBeenCalled();
  });

  it('addServer fails when the call throws', async () => {
    api.serverAdd.mockRejectedValue(new Error('ipc closed'));
    expect(await useServerStore.getState().addServer({ name: 'x' } as never)).toEqual({ ok: false, reason: null });
  });

  it('addServer returns the new server and reloads the list', async () => {
    const added = { ...server, id: 's2', name: 'Two' };
    api.serverAdd.mockResolvedValue({ success: true, data: added });
    api.serverList.mockResolvedValue({ success: true, data: [server, added] });
    expect(await useServerStore.getState().addServer({ name: 'Two' } as never)).toEqual({ ok: true, data: added });
    expect(useServerStore.getState().servers).toHaveLength(2);
  });

  it('save failures carry a translated reason when the code is known', async () => {
    api.serverAdd.mockResolvedValue({ success: false, error: 'raw', code: 'NETWORK' });
    const res = await useServerStore.getState().addServer({ name: 'x' } as never);
    expect(res).toMatchObject({ ok: false });
    expect(res.ok === false && res.reason).toBeTruthy();
    expect(res.ok === false && res.reason).toBe('Network error');
  });

  it('updateServer reports success and failure and keeps the old values on failure', async () => {
    api.serverUpdate.mockResolvedValueOnce({ success: false, error: 'nope' });
    expect(await useServerStore.getState().updateServer('s1', { name: 'Two' })).toEqual({ ok: false, reason: null });
    expect(useServerStore.getState().servers[0]?.name).toBe('One');

    api.serverUpdate.mockResolvedValueOnce({ success: true });
    api.serverList.mockResolvedValue({ success: true, data: [{ ...server, name: 'Two' }] });
    expect(await useServerStore.getState().updateServer('s1', { name: 'Two' })).toEqual({ ok: true, data: undefined });
    expect(useServerStore.getState().servers[0]?.name).toBe('Two');
  });

  it('updateServer fails when the call throws', async () => {
    api.serverUpdate.mockRejectedValue(new Error('ipc closed'));
    expect(await useServerStore.getState().updateServer('s1', { name: 'Two' })).toEqual({ ok: false, reason: null });
  });

  it('removeServer notifies, keeps the server and resolves false on failure', async () => {
    api.serverRemove.mockResolvedValue({ success: false, error: 'locked' });
    expect(await useServerStore.getState().removeServer('s1')).toBe(false);
    expect(keys()).toEqual(['notification.serverRemoveFailed']);
    expect(useServerStore.getState().servers).toHaveLength(1);
  });

  it('removeServer drops the server and resolves true on success', async () => {
    api.serverRemove.mockResolvedValue({ success: true });
    expect(await useServerStore.getState().removeServer('s1')).toBe(true);
    expect(useServerStore.getState().servers).toHaveLength(0);
    expect(keys()).toEqual([]);
  });

  it('testConnection resolves false when the call throws instead of rejecting', async () => {
    api.serverTest.mockRejectedValue(new Error('ipc closed'));
    expect(await useServerStore.getState().testConnection(server as never)).toBe(false);
  });
});

describe('server store updateServer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    initPlatformApi(api as unknown as PlatformApi);
    useServerStore.setState({
      servers: [{ id: 's1', name: 'Home', host: 'h', port: 9091, path: '/rpc', useSSL: false }],
    });
  });

  it('takes the stored flags from the reloaded list, so a host change refreshes hasPassword', async () => {
    useServerStore.setState({
      servers: [{ id: 's1', name: 'Home', host: 'h', port: 9091, path: '/rpc', useSSL: false, hasPassword: true }],
    });
    api.serverUpdate.mockResolvedValue({ success: true });
    api.serverList.mockResolvedValue({
      success: true,
      data: [{ id: 's1', name: 'Home', host: 'other', port: 9091, path: '/rpc', useSSL: false, hasPassword: false }],
    });
    await useServerStore.getState().updateServer('s1', { host: 'other' });
    expect(useServerStore.getState().servers[0]).toMatchObject({ host: 'other', hasPassword: false });
  });

  it('web flow: a changed password is never stale on the next edit', async () => {
    useServerStore.setState({
      servers: [{ id: 's1', name: 'Home', host: 'h', port: 9091, path: '/rpc', useSSL: false, password: 'old', hasPassword: true }],
    });
    api.serverUpdate.mockResolvedValue({ success: true });
    api.serverList.mockResolvedValue({
      success: true,
      data: [{ id: 's1', name: 'Home', host: 'h', port: 9091, path: '/rpc', useSSL: false, password: 'new', hasPassword: true }],
    });
    await useServerStore.getState().updateServer('s1', { password: 'new' });
    expect(useServerStore.getState().servers[0]?.password).toBe('new');
  });

  it('sends the clear flags through to the platform', async () => {
    api.serverUpdate.mockResolvedValue({ success: true });
    api.serverList.mockResolvedValue({ success: true, data: [] });
    await useServerStore.getState().updateServer('s1', { clearPassword: true });
    expect(api.serverUpdate).toHaveBeenCalledWith('s1', { clearPassword: true });
  });
});
