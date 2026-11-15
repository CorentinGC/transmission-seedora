import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ activeId: null as string | null, servers: [] as Record<string, unknown>[] }));
const actions = vi.hoisted(() => ({
  rpcRequest: vi.fn(),
  testServerConnection: vi.fn(),
  setActiveServerCookie: vi.fn(),
  clearServerCookie: vi.fn(),
  geoipLookup: vi.fn(),
}));

vi.mock('./web-storage', () => ({
  getServers: () => storage.servers,
  setServers: (s: Record<string, unknown>[]) => (storage.servers = s),
  getActiveServerId: () => storage.activeId,
  setActiveServerId: (id: string | null) => (storage.activeId = id),
  getPreferences: () => ({}),
  setPreferences: () => undefined,
}));
vi.mock('./server-actions/rpc', () => ({ rpcRequest: actions.rpcRequest, testServerConnection: actions.testServerConnection }));
vi.mock('./server-actions/session', () => ({ setActiveServerCookie: actions.setActiveServerCookie, clearServerCookie: actions.clearServerCookie }));
vi.mock('./server-actions/geoip', () => ({ geoipLookup: actions.geoipLookup }));

import { webApi } from './web-api';

const server = { id: 'a', name: 'A', host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: true };

beforeEach(() => {
  vi.clearAllMocks();
  storage.activeId = 'a';
  storage.servers = [server];
  actions.setActiveServerCookie.mockResolvedValue({ success: true });
});

describe('webApi RPC recovery', () => {
  it('re-seals the cookie and retries a call once after NO_SESSION', async () => {
    actions.rpcRequest
      .mockResolvedValueOnce({ success: false, error: 'x', code: 'NO_SESSION' })
      .mockResolvedValueOnce({ success: true, data: { torrents: [] } });
    expect(await webApi.rpcTorrentGet(['id'])).toEqual({ success: true, data: { torrents: [] } });
    expect(actions.setActiveServerCookie).toHaveBeenCalledTimes(1);
    expect(actions.rpcRequest).toHaveBeenCalledTimes(2);
    expect(actions.rpcRequest).toHaveBeenLastCalledWith('torrent-get', { fields: ['id'] });
  });
});

describe('webApi.serverSetActive', () => {
  it('persists the id only after the cookie was set', async () => {
    storage.activeId = null;
    expect(await webApi.serverSetActive('a')).toEqual({ success: true });
    expect(storage.activeId).toBe('a');
  });

  it('keeps the previous id and reports the failure when the cookie cannot be set', async () => {
    storage.servers = [server, { ...server, id: 'b' }];
    actions.setActiveServerCookie.mockResolvedValue({ success: false, error: 'Invalid request', code: 'INVALID_INPUT' });
    expect(await webApi.serverSetActive('b')).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    expect(storage.activeId).toBe('a');
    expect(await webApi.serverSetActive('missing')).toMatchObject({ success: false });
  });

  it('clears the cookie and the id for null', async () => {
    expect(await webApi.serverSetActive(null)).toEqual({ success: true });
    expect(actions.clearServerCookie).toHaveBeenCalled();
    expect(storage.activeId).toBeNull();
  });
});

describe('webApi.geoipLookup', () => {
  it('splits large lists into chunks of at most 512 and merges the results', async () => {
    const ips = Array.from({ length: 1100 }, (_, i) => `10.${Math.floor(i / 250)}.${i % 250}.1`);
    actions.geoipLookup.mockImplementation(async (batch: string[]) => ({
      success: true,
      data: Object.fromEntries(batch.map((ip) => [ip, null])),
    }));
    const result = await webApi.geoipLookup!(ips);
    expect(actions.geoipLookup.mock.calls.map(([b]) => b.length)).toEqual([512, 512, 76]);
    expect(result.success && Object.keys(result.data ?? {}).length).toBe(1100);
  });

  it('returns the first failure', async () => {
    actions.geoipLookup.mockResolvedValue({ success: false, error: 'Too many requests', code: 'RATE_LIMITED' });
    expect(await webApi.geoipLookup!(['8.8.8.8'])).toMatchObject({ success: false, code: 'RATE_LIMITED' });
  });
});
