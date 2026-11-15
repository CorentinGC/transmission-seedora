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

import { resetSessionRecovery } from './session-recovery';
import { webApi } from './web-api';

const server = { id: 'a', name: 'A', host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: true };

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionRecovery();
  storage.activeId = 'a';
  storage.servers = [server];
  actions.setActiveServerCookie.mockResolvedValue({ success: true });
  actions.clearServerCookie.mockResolvedValue({ success: true });
});

describe('webApi RPC recovery', () => {
  it('re-seals the cookie and retries a call once after NO_SESSION', async () => {
    actions.rpcRequest
      .mockResolvedValueOnce({ success: false, error: 'x', code: 'NO_SESSION' })
      .mockResolvedValueOnce({ success: true, data: { torrents: [] } });
    expect(await webApi.rpcTorrentGet(['id'])).toEqual({ success: true, data: { torrents: [] } });
    expect(actions.setActiveServerCookie).toHaveBeenCalledTimes(1);
    expect(actions.rpcRequest).toHaveBeenCalledTimes(2);
    expect(actions.rpcRequest).toHaveBeenLastCalledWith('torrent-get', JSON.stringify({ fields: ['id'] }));
  });
});

describe('webApi RPC arguments', () => {
  it('sends the arguments as a JSON string, dropping undefined and turning NaN into null', async () => {
    actions.rpcRequest.mockResolvedValue({ success: true, data: {} });
    await webApi.rpcTorrentGet(['id']);
    expect(actions.rpcRequest).toHaveBeenLastCalledWith('torrent-get', '{"fields":["id"]}');
    await webApi.rpcSessionGet();
    expect(actions.rpcRequest).toHaveBeenLastCalledWith('session-get', undefined);
    await webApi.rpcSessionSet({ 'speed-limit-down': NaN, gone: undefined, kept: 1 });
    expect(actions.rpcRequest).toHaveBeenLastCalledWith('session-set', '{"speed-limit-down":null,"kept":1}');
  });

  it('fails locally, without a server call, when the arguments cannot be serialised', async () => {
    actions.rpcRequest.mockClear();
    const result = await webApi.rpcSessionSet({ big: BigInt(1) });
    expect(result).toMatchObject({ success: false });
    expect(actions.rpcRequest).not.toHaveBeenCalled();
  });
});

describe('webApi.serverSetActive', () => {
  it('stores the new id before the cookie is written, so a racing recovery seals the new server', async () => {
    storage.servers = [server, { ...server, id: 'b', host: 'other.example.com' }];
    let idWhenWriting: string | null = null;
    actions.setActiveServerCookie.mockImplementation(async () => {
      idWhenWriting = storage.activeId;
      return { success: true };
    });
    expect(await webApi.serverSetActive('b')).toEqual({ success: true });
    expect(idWhenWriting).toBe('b');
    expect(storage.activeId).toBe('b');
  });

  it('ends on the new server when a recovery re-seal started before the switch', async () => {
    storage.servers = [server, { ...server, id: 'b', host: 'other.example.com' }];
    const sealed: string[] = [];
    let releaseFirst!: () => void;
    actions.setActiveServerCookie.mockImplementationOnce(async (target: { host: string }) => {
      sealed.push(target.host);
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      return { success: true };
    });
    actions.setActiveServerCookie.mockImplementation(async (target: { host: string }) => {
      sealed.push(target.host);
      return { success: true };
    });
    actions.rpcRequest
      .mockResolvedValueOnce({ success: false, error: 'x', code: 'NO_SESSION' })
      .mockResolvedValue({ success: true });
    const recovering = webApi.rpcSessionStats();
    await vi.waitFor(() => expect(sealed).toEqual(['nas.example.com']));
    await webApi.serverSetActive('b');
    releaseFirst();
    await recovering;
    expect(sealed.at(-1)).toBe('other.example.com');
  });

  it('persists the id when the cookie was set', async () => {
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

  it('does not undo a later switch when its own cookie write fails', async () => {
    storage.servers = [server, { ...server, id: 'b' }, { ...server, id: 'c' }];
    actions.setActiveServerCookie.mockImplementationOnce(async () => {
      storage.activeId = 'c';
      return { success: false, error: 'x', code: 'INVALID_INPUT' };
    });
    await webApi.serverSetActive('b');
    expect(storage.activeId).toBe('c');
  });

  it('clears the cookie and the id for null', async () => {
    expect(await webApi.serverSetActive(null)).toEqual({ success: true });
    expect(actions.clearServerCookie).toHaveBeenCalled();
    expect(storage.activeId).toBeNull();
  });

  it('returns the failure when the cookie cannot be cleared', async () => {
    const failed = { success: false, error: 'x', code: 'SERVER_MISCONFIGURED' };
    actions.clearServerCookie.mockResolvedValue(failed);
    expect(await webApi.serverSetActive(null)).toEqual(failed);
    storage.activeId = 'a';
    expect(await webApi.serverRemove('a')).toEqual(failed);
  });
});

describe('webApi.serverUpdate', () => {
  it('re-seals the cookie with the new target when the active server is edited', async () => {
    expect(await webApi.serverUpdate('a', { host: ' new.example.com ', port: 1234, path: 'rpc', username: 'u', password: 'p', allowSelfSigned: true } as never)).toEqual({ success: true });
    expect(storage.servers[0]).toMatchObject({ host: ' new.example.com ', port: 1234 });
    expect(actions.setActiveServerCookie).toHaveBeenCalledTimes(1);
    expect(actions.setActiveServerCookie).toHaveBeenCalledWith({
      host: 'new.example.com', port: 1234, path: '/rpc', useSSL: true, username: 'u', password: 'p', allowSelfSigned: true,
    });
  });

  it('does not touch the cookie when another server is edited', async () => {
    storage.servers = [server, { ...server, id: 'b' }];
    expect(await webApi.serverUpdate('b', { host: 'x.example.com' })).toEqual({ success: true });
    expect(actions.setActiveServerCookie).not.toHaveBeenCalled();
  });

  it('does not touch the cookie when there is no active server', async () => {
    storage.activeId = null;
    await webApi.serverUpdate('a', { host: 'x.example.com' });
    expect(actions.setActiveServerCookie).not.toHaveBeenCalled();
  });

  it('reports a failed re-seal and reports an unknown server', async () => {
    actions.setActiveServerCookie.mockResolvedValue({ success: false, error: 'x', code: 'INVALID_INPUT' });
    expect(await webApi.serverUpdate('a', { host: 'x.example.com' })).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    expect(await webApi.serverUpdate('missing', {})).toMatchObject({ success: false });
  });

  it('keeps session recovery sealing the edited target afterwards', async () => {
    await webApi.serverUpdate('a', { host: 'edited.example.com' });
    actions.setActiveServerCookie.mockClear();
    actions.rpcRequest
      .mockResolvedValueOnce({ success: false, error: 'x', code: 'NO_SESSION' })
      .mockResolvedValueOnce({ success: true });
    await webApi.rpcSessionStats();
    expect(actions.setActiveServerCookie).toHaveBeenCalledWith(expect.objectContaining({ host: 'edited.example.com' }));
  });
});

describe('webApi fail-closed re-seal', () => {
  it('clears the old cookie when the re-seal of an edited active server fails', async () => {
    actions.setActiveServerCookie.mockResolvedValueOnce({ success: false, error: 'x', code: 'RATE_LIMITED' });
    expect(await webApi.serverUpdate('a', { host: 'new.example.com', allowSelfSigned: false } as never)).toMatchObject({ success: false, code: 'RATE_LIMITED' });
    expect(actions.clearServerCookie).toHaveBeenCalledTimes(1);
    actions.setActiveServerCookie.mockClear();
    actions.rpcRequest
      .mockResolvedValueOnce({ success: false, error: 'x', code: 'NO_SESSION' })
      .mockResolvedValueOnce({ success: true });
    await webApi.rpcSessionStats();
    expect(storage.servers[0]).toMatchObject({ host: 'nas.example.com' });
    expect(actions.setActiveServerCookie).toHaveBeenCalledWith(expect.objectContaining({ host: 'nas.example.com' }));
  });

  it('still returns the re-seal failure when the clear fails too', async () => {
    actions.setActiveServerCookie.mockResolvedValue({ success: false, error: 'x', code: 'RATE_LIMITED' });
    actions.clearServerCookie.mockResolvedValue({ success: false, error: 'y', code: 'SERVER_MISCONFIGURED' });
    expect(await webApi.serverUpdate('a', { host: 'new.example.com' })).toMatchObject({ success: false, code: 'RATE_LIMITED' });
  });

  it('re-seals on import when the active server target changed', async () => {
    expect(await webApi.configImport({ servers: [{ ...server, host: 'imported.example.com' }] })).toEqual({ success: true });
    expect(actions.setActiveServerCookie).toHaveBeenCalledWith(expect.objectContaining({ host: 'imported.example.com' }));
  });

  it('does not touch the cookie on import when the active target is unchanged', async () => {
    await webApi.configImport({ servers: [{ ...server, name: 'Renamed' }] });
    expect(actions.setActiveServerCookie).not.toHaveBeenCalled();
    expect(actions.clearServerCookie).not.toHaveBeenCalled();
  });

  it('clears the cookie when the import fails to re-seal the changed active server', async () => {
    actions.setActiveServerCookie.mockResolvedValue({ success: false, error: 'x', code: 'RATE_LIMITED' });
    expect(await webApi.configImport({ servers: [{ ...server, host: 'imported.example.com' }] })).toMatchObject({ success: false, code: 'RATE_LIMITED' });
    expect(actions.clearServerCookie).toHaveBeenCalledTimes(1);
  });

  it('clears the cookie and the active id when the import drops the active server', async () => {
    expect(await webApi.configImport({ servers: [{ ...server, id: 'z' }] })).toEqual({ success: true });
    expect(actions.clearServerCookie).toHaveBeenCalledTimes(1);
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
