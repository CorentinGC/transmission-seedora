import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  activeId: null as string | null,
  servers: [] as Record<string, unknown>[],
  prefs: {} as Record<string, unknown>,
}));
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
  getPreferences: () => storage.prefs,
  setPreferences: (p: Record<string, unknown>) => (storage.prefs = { ...storage.prefs, ...p }),
}));
vi.mock('./server-actions/rpc', () => ({
  rpcRequest: actions.rpcRequest,
  testServerConnection: actions.testServerConnection,
}));
vi.mock('./server-actions/session', () => ({
  setActiveServerCookie: actions.setActiveServerCookie,
  clearServerCookie: actions.clearServerCookie,
}));
vi.mock('./server-actions/geoip', () => ({ geoipLookup: actions.geoipLookup }));

import { resetSessionRecovery } from './session-recovery';
import { webApi } from './web-api';

const server = { id: 'a', name: 'A', host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: true };

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionRecovery();
  storage.activeId = 'a';
  storage.servers = [server];
  storage.prefs = {};
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
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
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
    actions.setActiveServerCookie.mockResolvedValue({
      success: false,
      error: 'Invalid request',
      code: 'INVALID_INPUT',
    });
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
    expect(
      await webApi.serverUpdate('a', {
        host: ' new.example.com ',
        port: 1234,
        path: 'rpc',
        username: 'u',
        password: 'p',
        allowSelfSigned: true,
      } as never),
    ).toMatchObject({ success: true });
    expect(storage.servers[0]).toMatchObject({ host: ' new.example.com ', port: 1234 });
    expect(actions.setActiveServerCookie).toHaveBeenCalledTimes(1);
    expect(actions.setActiveServerCookie).toHaveBeenCalledWith({
      host: 'new.example.com',
      port: 1234,
      path: '/rpc',
      useSSL: true,
      username: 'u',
      password: 'p',
      allowSelfSigned: true,
    });
  });

  it('does not touch the cookie when another server is edited', async () => {
    storage.servers = [server, { ...server, id: 'b' }];
    expect(await webApi.serverUpdate('b', { host: 'x.example.com' })).toMatchObject({ success: true });
    expect(actions.setActiveServerCookie).not.toHaveBeenCalled();
  });

  it('does not touch the cookie when there is no active server', async () => {
    storage.activeId = null;
    await webApi.serverUpdate('a', { host: 'x.example.com' });
    expect(actions.setActiveServerCookie).not.toHaveBeenCalled();
  });

  it('reports a failed re-seal and reports an unknown server', async () => {
    actions.setActiveServerCookie.mockResolvedValue({ success: false, error: 'x', code: 'INVALID_INPUT' });
    expect(await webApi.serverUpdate('a', { host: 'x.example.com' })).toMatchObject({
      success: false,
      code: 'INVALID_INPUT',
    });
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
    expect(await webApi.serverUpdate('a', { host: 'new.example.com', allowSelfSigned: false } as never)).toMatchObject({
      success: false,
      code: 'RATE_LIMITED',
    });
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
    expect(await webApi.serverUpdate('a', { host: 'new.example.com' })).toMatchObject({
      success: false,
      code: 'RATE_LIMITED',
    });
  });
});

describe('webApi.configImport', () => {
  const INVALID = { success: false, error: 'Import failed: invalid file', code: 'IMPORT_INVALID' };
  const fresh = { name: 'B', host: 'b.example.com', port: 9091, path: '/transmission/rpc', useSSL: false };

  it('adds new servers with a fresh id, strips allowSelfSigned and reports counts', async () => {
    const result = await webApi.configImport({ servers: [{ ...fresh, id: 'a', allowSelfSigned: true, extra: 1 }] });
    expect(result).toEqual({ success: true, data: { serversAdded: 1, serversSkipped: 0, prefsImported: false } });
    expect(storage.servers).toHaveLength(2);
    expect(storage.servers[0]).toEqual(server);
    const added = storage.servers[1];
    if (added === undefined) throw new Error('server was not added');
    expect(added.id).toEqual(expect.any(String));
    expect(added.id).not.toBe('a');
    expect(added).not.toHaveProperty('allowSelfSigned');
    expect(added).not.toHaveProperty('extra');
  });

  it('skips duplicates (host+port+path) against existing and earlier entries, never updating them', async () => {
    const result = await webApi.configImport({
      servers: [
        { ...server, name: 'Renamed', username: 'u' },
        fresh,
        { ...fresh, name: 'again' },
        { ...fresh, path: '/other' },
      ],
    });
    expect(result).toEqual({ success: true, data: { serversAdded: 2, serversSkipped: 2, prefsImported: false } });
    expect(storage.servers[0]).toEqual(server);
    expect(storage.servers.map((s) => s.path)).toEqual(['/transmission/rpc', '/transmission/rpc', '/other']);
    expect(storage.servers[1]?.name).toBe('B');
  });

  it('compares host, port and path by exact string equality', async () => {
    const result = await webApi.configImport({ servers: [{ ...server, host: 'NAS.example.com' }] });
    expect(result).toMatchObject({ data: { serversAdded: 1 } });
  });

  it('leaves the active server, active id and cookie untouched', async () => {
    await webApi.configImport({
      servers: [
        { ...server, name: 'Renamed' },
        { ...fresh, host: 'imported.example.com' },
      ],
    });
    expect(storage.activeId).toBe('a');
    expect(actions.setActiveServerCookie).not.toHaveBeenCalled();
    expect(actions.clearServerCookie).not.toHaveBeenCalled();
  });

  it('applies nothing when any server is invalid', async () => {
    storage.prefs = { theme: 'light' };
    const result = await webApi.configImport({
      servers: [fresh, { ...fresh, host: 'a/b' }],
      preferences: { theme: 'dark' },
    });
    expect(result).toEqual(INVALID);
    expect(storage.servers).toEqual([server]);
    expect(storage.prefs).toEqual({ theme: 'light' });
  });

  it('applies nothing when the preferences are invalid, without leaking details', async () => {
    const result = await webApi.configImport({ servers: [fresh], preferences: { pollingInterval: 1 } });
    expect(result).toEqual(INVALID);
    expect(storage.servers).toEqual([server]);
  });

  it('rejects non-object payloads and oversized lists', async () => {
    expect(await webApi.configImport(null as never)).toEqual(INVALID);
    expect(await webApi.configImport({ servers: 'x' })).toEqual(INVALID);
    expect(await webApi.configImport({ servers: Array(1001).fill(fresh) })).toEqual(INVALID);
    expect(storage.servers).toEqual([server]);
  });

  it('patches preferences, keeps omitted keys and drops watchFolder', async () => {
    storage.prefs = { theme: 'light', language: 'fr' };
    const result = await webApi.configImport({ preferences: { theme: 'dark', watchFolder: '/etc', bogus: 1 } });
    expect(result).toEqual({ success: true, data: { serversAdded: 0, serversSkipped: 0, prefsImported: true } });
    expect(storage.prefs).toEqual({ theme: 'dark', language: 'fr' });
  });

  it('leaves preferences untouched when absent', async () => {
    storage.prefs = { theme: 'light' };
    await webApi.configImport({ servers: [fresh] });
    expect(storage.prefs).toEqual({ theme: 'light' });
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

describe('webApi configExport (c07.8)', () => {
  const withSecrets = {
    ...server,
    username: 'alice',
    password: 'hunter2',
    proxyType: 'http',
    proxyPassword: 'proxy-secret',
  };

  it('omits server and proxy passwords by default, keeping usernames', async () => {
    storage.servers = [withSecrets];
    const res = await webApi.configExport({ servers: true });
    const [exported] = (res.data as { servers: Record<string, unknown>[] }).servers;
    expect(exported).toMatchObject({ host: 'nas.example.com', username: 'alice' });
    expect(exported).not.toHaveProperty('password');
    expect(exported).not.toHaveProperty('proxyPassword');
    expect(JSON.stringify(res)).not.toContain('hunter2');
    expect(JSON.stringify(res)).not.toContain('proxy-secret');
  });

  it('includes passwords only with the exact opt-in', async () => {
    storage.servers = [withSecrets];
    for (const includePasswords of [undefined, false, 'true', 1]) {
      const res = await webApi.configExport({ servers: true, includePasswords } as never);
      expect(JSON.stringify(res)).not.toContain('hunter2');
    }
    const res = await webApi.configExport({ servers: true, includePasswords: true } as never);
    const [exported] = (res.data as { servers: Record<string, unknown>[] }).servers;
    expect(exported).toMatchObject({ password: 'hunter2', proxyPassword: 'proxy-secret' });
  });

  it('does not mutate the stored servers and still honours serverIds', async () => {
    storage.servers = [withSecrets, { ...withSecrets, id: 'b' }];
    const res = await webApi.configExport({ servers: true, serverIds: ['b'] });
    expect((res.data as { servers: { id: string }[] }).servers.map((s) => s.id)).toEqual(['b']);
    expect(storage.servers[0]).toHaveProperty('password', 'hunter2');
  });
});

describe('webApi failures carry a code the UI can translate (q45)', () => {
  it('flags an unknown server id with SERVER_NOT_FOUND on update and activation', async () => {
    const expected = { success: false, error: 'Server not found', code: 'SERVER_NOT_FOUND' };
    expect(await webApi.serverUpdate('missing', { name: 'x' })).toEqual(expected);
    expect(await webApi.serverSetActive('missing')).toEqual(expected);
  });

  it('flags unserialisable RPC arguments with INVALID_INPUT', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(await webApi.rpcTorrentSet([1], circular)).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    expect(actions.rpcRequest).not.toHaveBeenCalled();
  });

  it('passes the code of a server action failure through unchanged', async () => {
    actions.rpcRequest.mockResolvedValue({
      success: false,
      error: 'Too many requests, try again shortly',
      code: 'RATE_LIMITED',
    });
    expect(await webApi.rpcSessionGet()).toEqual({
      success: false,
      error: 'Too many requests, try again shortly',
      code: 'RATE_LIMITED',
    });
  });
});

describe('webApi.serverUpdate credentials', () => {
  const secret = { ...server, username: 'alice', password: 'hunter2', proxyType: 'http', proxyPassword: 'proxy-pw' };
  const sealedPassword = () => actions.setActiveServerCookie.mock.calls.at(-1)?.[0].password;

  it('keeps the stored password when the patch has none, an empty one or undefined; twice in a row', async () => {
    storage.servers = [secret];
    await webApi.serverUpdate('a', { name: 'B', password: '' });
    await webApi.serverUpdate('a', { name: 'C', password: undefined, proxyPassword: '' });
    expect(storage.servers[0]).toMatchObject({ name: 'C', password: 'hunter2', proxyPassword: 'proxy-pw' });
    expect(sealedPassword()).toBe('hunter2');
  });

  it('does not let an undefined field erase another one', async () => {
    storage.servers = [secret];
    await webApi.serverUpdate('a', { username: undefined, host: 'x.example.com' });
    expect(storage.servers[0]).toMatchObject({ username: 'alice', host: 'x.example.com' });
  });

  it('replaces the password when a non-empty one is given', async () => {
    storage.servers = [secret];
    await webApi.serverUpdate('a', { password: 'new' });
    expect(storage.servers[0]).toMatchObject({ password: 'new', proxyPassword: 'proxy-pw' });
    expect(sealedPassword()).toBe('new');
  });

  it('clears the password only with an explicit clearPassword, and the proxy one with clearProxyPassword', async () => {
    storage.servers = [secret];
    await webApi.serverUpdate('a', { clearPassword: true } as never);
    expect(storage.servers[0]).not.toHaveProperty('password');
    expect(storage.servers[0]).toHaveProperty('proxyPassword', 'proxy-pw');
    expect(sealedPassword()).toBeUndefined();
    await webApi.serverUpdate('a', { clearProxyPassword: true } as never);
    expect(storage.servers[0]).not.toHaveProperty('proxyPassword');
  });

  it('never stores the clear flags, and clear wins over a password in the same patch', async () => {
    storage.servers = [secret];
    await webApi.serverUpdate('a', { clearPassword: true, password: 'x' } as never);
    expect(storage.servers[0]).not.toHaveProperty('clearPassword');
    expect(storage.servers[0]).not.toHaveProperty('password');
    await webApi.serverUpdate('a', { clearPassword: 'yes' } as never);
    expect(storage.servers[0]).not.toHaveProperty('clearPassword');
  });

  it('rolls back to the previous entry, password included, when the re-seal is refused', async () => {
    storage.servers = [secret];
    actions.setActiveServerCookie.mockResolvedValue({ success: false, error: 'x', code: 'INVALID_INPUT' });
    await webApi.serverUpdate('a', { clearPassword: true, host: 'x.example.com' } as never);
    expect(storage.servers[0]).toMatchObject({ password: 'hunter2', host: 'nas.example.com' });
  });
});

describe('webApi password flags', () => {
  const secret = { ...server, password: 'hunter2', proxyPassword: 'proxy-pw' };

  it('serverList derives hasPassword and hasProxyPassword, keeping the passwords for the form', async () => {
    storage.servers = [secret, { ...server, id: 'b', password: '' }];
    const res = await webApi.serverList();
    expect(res.data).toMatchObject([
      { id: 'a', password: 'hunter2', hasPassword: true, hasProxyPassword: true },
      { id: 'b', hasPassword: false, hasProxyPassword: false },
    ]);
  });

  it('serverAdd returns the flags but never stores them or the clear flags', async () => {
    const res = await webApi.serverAdd({ ...server, password: 'pw', hasPassword: false, clearPassword: true } as never);
    expect(res.data).toMatchObject({ password: 'pw', hasPassword: true, hasProxyPassword: false });
    const stored = storage.servers.at(-1)!;
    expect(stored).toHaveProperty('password', 'pw');
    expect(stored).not.toHaveProperty('hasPassword');
    expect(stored).not.toHaveProperty('clearPassword');
  });

  it('serverUpdate returns the updated server with consistent flags and stores none of them', async () => {
    storage.servers = [secret];
    const cleared = await webApi.serverUpdate('a', { clearPassword: true, hasPassword: true } as never);
    expect(cleared.data).toMatchObject({ hasPassword: false, hasProxyPassword: true });
    expect(storage.servers[0]).not.toHaveProperty('hasPassword');
    const set = await webApi.serverUpdate('a', { password: 'again' });
    expect(set.data).toMatchObject({ hasPassword: true, password: 'again' });
  });
});
