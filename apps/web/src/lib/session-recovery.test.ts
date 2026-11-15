import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ activeId: 'a' as string | null, servers: [] as Record<string, unknown>[] }));
const setCookie = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock('./web-storage', () => ({
  getActiveServerId: () => storage.activeId,
  getServers: () => storage.servers,
}));
vi.mock('./server-actions/session', () => ({ setActiveServerCookie: setCookie.fn }));

import { MAX_GEOIP_IPS } from './server/schemas';
import { GEOIP_CHUNK_SIZE, chunk, toServerTarget, withSessionRecovery } from './session-recovery';

const noSession = { success: false, error: 'No active server configured', code: 'NO_SESSION' };

beforeEach(() => {
  storage.activeId = 'a';
  storage.servers = [{ id: 'a', host: 'nas.example.com', port: 9091, path: '', useSSL: false }];
  setCookie.fn.mockReset().mockResolvedValue({ success: true });
});

describe('withSessionRecovery', () => {
  it('re-seals from the stored active server and retries once on NO_SESSION', async () => {
    const call = vi.fn().mockResolvedValueOnce(noSession).mockResolvedValueOnce({ success: true, data: 1 });
    expect(await withSessionRecovery(call)).toEqual({ success: true, data: 1 });
    expect(setCookie.fn).toHaveBeenCalledWith({ host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: false, username: undefined, password: undefined });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('retries only once when the session is still missing', async () => {
    const call = vi.fn().mockResolvedValue(noSession);
    expect(await withSessionRecovery(call)).toEqual(noSession);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors or successes', async () => {
    const call = vi.fn().mockResolvedValue({ success: false, code: 'TIMEOUT' });
    await withSessionRecovery(call);
    expect(call).toHaveBeenCalledTimes(1);
    expect(setCookie.fn).not.toHaveBeenCalled();
  });

  it('returns the original error when there is no stored active server or the re-seal fails', async () => {
    storage.activeId = null;
    const call = vi.fn().mockResolvedValue(noSession);
    expect(await withSessionRecovery(call)).toEqual(noSession);
    expect(call).toHaveBeenCalledTimes(1);

    storage.activeId = 'a';
    setCookie.fn.mockResolvedValue({ success: false, code: 'RATE_LIMITED' });
    expect(await withSessionRecovery(call)).toEqual(noSession);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('shares one re-seal between concurrent calls', async () => {
    const make = () => vi.fn().mockResolvedValueOnce(noSession).mockResolvedValueOnce({ success: true });
    await Promise.all([withSessionRecovery(make()), withSessionRecovery(make()), withSessionRecovery(make())]);
    expect(setCookie.fn).toHaveBeenCalledTimes(1);
  });
});

describe('chunk', () => {
  it('splits into batches of at most the size, matching the server limit', () => {
    expect(GEOIP_CHUNK_SIZE).toBe(MAX_GEOIP_IPS);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe('toServerTarget', () => {
  const base = { host: 'h', port: 1, useSSL: true };
  it('normalises the path and drops empty credentials and extra fields', () => {
    expect(toServerTarget({ ...base, path: '' }).path).toBe('/transmission/rpc');
    expect(toServerTarget({ ...base, path: 'rpc' }).path).toBe('/rpc');
    expect(toServerTarget({ ...base, path: '/x', username: '', password: '' })).toEqual({
      host: 'h', port: 1, path: '/x', useSSL: true, username: undefined, password: undefined,
    });
    const withProxy = { ...base, path: '/x', proxyPassword: 'secret', id: 'i' };
    expect(JSON.stringify(toServerTarget(withProxy))).not.toContain('secret');
  });
});
