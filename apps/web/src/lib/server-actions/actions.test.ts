import { sealData } from 'iron-session';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../server/limits';
import { RATE_LIMITS } from '../server/rate-limit';
import { clearSessionIdCache } from '../server/transmission';

const jar = vi.hoisted(() => ({
  store: new Map<string, string>(),
  deleted: [] as string[],
  setCalls: [] as { name: string; value: string; options: Record<string, unknown> | undefined }[],
}));
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      jar.setCalls.push({ name, value, options });
      jar.store.set(name, value);
    },
    delete: (name: string) => {
      jar.deleted.push(name);
      jar.store.delete(name);
    },
  }),
  headers: async () => requestHeaders.current,
}));

const post = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../server/outbound', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/outbound')>();
  return { ...actual, postJson: (...args: Parameters<typeof actual.postJson>) => post.fn(...args) };
});

import { geoipLookup } from './geoip';
import { rpcRequest, testServerConnection } from './rpc';
import { clearServerCookie, setActiveServerCookie } from './session';

const SECRET = 'test-secret-0123456789-abcdefghijklmnop';
const PASSWORD = 'hunter2-very-secret';
const COOKIE = 'seedora-session';
const target = { host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: true, username: 'alice', password: PASSWORD };
const success = { status: 200, sessionId: undefined, json: { result: 'success', arguments: { ok: true } } };

async function realPost(...args: Parameters<typeof import('../server/outbound').postJson>) {
  const actual = await vi.importActual<typeof import('../server/outbound')>('../server/outbound');
  return actual.postJson(...args);
}

async function activate(): Promise<void> {
  expect(await setActiveServerCookie(target)).toEqual({ success: true });
}

beforeEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.stubEnv('COOKIE_SECRET', SECRET);
  jar.store.clear();
  jar.deleted.length = 0;
  jar.setCalls.length = 0;
  requestHeaders.current = new Headers();
  post.fn.mockReset().mockResolvedValue(success);
  resetRateLimits();
  clearSessionIdCache();
});

describe('setActiveServerCookie', () => {
  it('seals the target, never stores the password in clear, and deletes the legacy cookie', async () => {
    await activate();
    const stored = jar.store.get(COOKIE)!;
    expect(stored).not.toContain(PASSWORD);
    expect(stored.startsWith('Fe26.')).toBe(true);
    expect(jar.setCalls[0].options).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/' });
    expect(jar.deleted).toContain('seedora_server');
  });

  it('rejects malformed targets without touching the cookie', async () => {
    for (const bad of [null, 'x', {}, { ...target, host: 'http://evil.test' }, { ...target, port: 70000 }, { ...target, path: '/a/../b' }, { ...target, useSSL: 'yes' }]) {
      expect(await setActiveServerCookie(bad)).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    }
    expect(jar.store.size).toBe(0);
  });

  it('maps a missing production secret to SERVER_MISCONFIGURED', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('COOKIE_SECRET', '');
    expect(await setActiveServerCookie(target)).toMatchObject({ success: false, code: 'SERVER_MISCONFIGURED' });
  });

  it('is rate limited', async () => {
    const results = [];
    for (let i = 0; i < RATE_LIMITS.setActiveServer.burst + 1; i++) results.push(await setActiveServerCookie(target));
    expect(results.at(-1)).toMatchObject({ success: false, code: 'RATE_LIMITED' });
  });
});

describe('clearServerCookie', () => {
  it('expires the session cookie keeping its attributes, and deletes the legacy one', async () => {
    await clearServerCookie();
    expect(jar.setCalls[0]).toMatchObject({ name: COOKIE, value: '', options: { maxAge: 0, path: '/' } });
    expect(jar.deleted).toContain('seedora_server');
  });
});

describe('rpcRequest', () => {
  it('forwards an allowlisted call to the sealed target', async () => {
    await activate();
    const result = await rpcRequest('torrent-get', { fields: ['id'] });
    expect(result).toEqual({ success: true, data: { ok: true } });
    expect(post.fn.mock.calls[0][0]).toMatchObject({ host: 'nas.example.com', port: 9091, useSSL: true });
    expect(post.fn.mock.calls[0][2].allowPrivate).toBe(false);
  });

  it('rejects non-allowlisted methods before any outbound call', async () => {
    await activate();
    for (const method of ['session-test', 'torrent-add ', '__proto__', 'constructor', '', 'free-space\n']) {
      expect(await rpcRequest(method)).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    }
    expect(post.fn).not.toHaveBeenCalled();
  });

  it('rejects oversized, non-object and prototype-polluting arguments', async () => {
    await activate();
    const big = { 'metainfo': 'a'.repeat(1024 * 1024 + 1) };
    expect(await rpcRequest('torrent-add', big)).toMatchObject({ code: 'INVALID_INPUT' });
    expect(await rpcRequest('torrent-get', 'nope')).toMatchObject({ code: 'INVALID_INPUT' });
    expect(await rpcRequest('torrent-get', JSON.parse('{"__proto__":{"x":1}}'))).toMatchObject({ code: 'INVALID_INPUT' });
    expect(await rpcRequest('torrent-get', { ids: { evil: true } })).toMatchObject({ code: 'INVALID_INPUT' });
    expect(post.fn).not.toHaveBeenCalled();
  });

  it('returns NO_SESSION without a cookie, with a tampered one, and with the legacy base64 cookie', async () => {
    expect(await rpcRequest('session-get')).toMatchObject({ success: false, code: 'NO_SESSION' });

    await activate();
    jar.store.set(COOKIE, jar.store.get(COOKIE)!.slice(0, -4) + 'AAAA');
    expect(await rpcRequest('session-get')).toMatchObject({ code: 'NO_SESSION' });

    jar.store.clear();
    jar.store.set('seedora_server', Buffer.from(JSON.stringify(target)).toString('base64'));
    expect(await rpcRequest('session-get')).toMatchObject({ code: 'NO_SESSION' });
    jar.store.set(COOKIE, Buffer.from(JSON.stringify(target)).toString('base64'));
    expect(await rpcRequest('session-get')).toMatchObject({ code: 'NO_SESSION' });

    const forged = await sealData({ v: 1, ...target, host: 'evil.test' }, { password: 'x'.repeat(40) });
    jar.store.set(COOKIE, forged);
    expect(await rpcRequest('session-get')).toMatchObject({ code: 'NO_SESSION' });
    expect(post.fn).not.toHaveBeenCalled();
  });

  it('denies a private host by default, and allows it with SEEDORA_ALLOW_PRIVATE_HOSTS', async () => {
    post.fn.mockImplementation(realPost);
    expect(await setActiveServerCookie({ ...target, host: '192.168.1.10', port: 9091 })).toEqual({ success: true });
    expect(await rpcRequest('session-get')).toMatchObject({ success: false, code: 'HOST_NOT_ALLOWED' });

    vi.stubEnv('SEEDORA_ALLOW_PRIVATE_HOSTS', 'true');
    post.fn.mockReset().mockResolvedValue(success);
    expect(await rpcRequest('session-get')).toEqual({ success: true, data: { ok: true } });
    expect(post.fn.mock.calls[0][2].allowPrivate).toBe(true);
  });

  it('retries the 409 handshake once', async () => {
    await activate();
    post.fn
      .mockResolvedValueOnce({ status: 409, sessionId: 'sid-1', json: undefined })
      .mockResolvedValueOnce({ status: 409, sessionId: 'sid-2', json: undefined });
    expect(await rpcRequest('session-get')).toMatchObject({ success: false, code: 'SESSION_ID_REJECTED' });
    expect(post.fn).toHaveBeenCalledTimes(2);
  });

  it('is rate limited per destination and when the client is identified', async () => {
    // Freeze the clock so the buckets do not refill while the loops run.
    vi.useFakeTimers({ toFake: ['Date'] });
    await activate();
    for (let i = 0; i < RATE_LIMITS.rpcDestination.burst; i++) await rpcRequest('session-get');
    expect(await rpcRequest('session-get')).toMatchObject({ success: false, code: 'RATE_LIMITED' });

    resetRateLimits();
    vi.stubEnv('SEEDORA_TRUST_PROXY_HEADERS', 'true');
    requestHeaders.current = new Headers({ 'x-forwarded-for': '203.0.113.9' });
    post.fn.mockClear();
    for (let i = 0; i < RATE_LIMITS.rpcClient.burst; i++) await rpcRequest('session-get');
    expect(await rpcRequest('session-get')).toMatchObject({ code: 'RATE_LIMITED' });
    expect(post.fn).toHaveBeenCalledTimes(RATE_LIMITS.rpcClient.burst);
    vi.useRealTimers();
  });

  it('never returns the password or raw error text', async () => {
    await activate();
    post.fn.mockRejectedValue(new Error(`boom ${PASSWORD} 10.1.2.3`));
    const result = await rpcRequest('session-get');
    expect(result).toMatchObject({ success: false, code: 'CONNECTION_FAILED' });
    expect(JSON.stringify(result)).not.toMatch(/hunter2|10\.1\.2\.3|boom/);
  });
});

describe('testServerConnection', () => {
  it('validates the target before any network activity', async () => {
    for (const bad of [undefined, {}, { ...target, host: '' }, { ...target, port: 0 }]) {
      expect(await testServerConnection(bad)).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    }
    expect(post.fn).not.toHaveBeenCalled();
  });

  it('tests session-get within 8 s and returns success only', async () => {
    const result = await testServerConnection(target);
    expect(result).toEqual({ success: true });
    expect(post.fn.mock.calls[0][1]).toEqual({ method: 'session-get', arguments: { fields: ['version'] } });
    expect(post.fn.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal);
  });

  it('denies private hosts by default and reports a bad login', async () => {
    post.fn.mockImplementation(realPost);
    expect(await testServerConnection({ ...target, host: '169.254.169.254' })).toMatchObject({ code: 'HOST_NOT_ALLOWED' });
    post.fn.mockReset().mockResolvedValue({ status: 401, sessionId: undefined, json: undefined });
    expect(await testServerConnection(target)).toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('is rate limited', async () => {
    for (let i = 0; i < RATE_LIMITS.testConnection.burst; i++) await testServerConnection(target);
    expect(await testServerConnection(target)).toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('geoipLookup', () => {
  it('looks up valid IPs and deduplicates', async () => {
    const result = await geoipLookup(['8.8.8.8', '8.8.8.8']);
    expect(result.success).toBe(true);
    if (result.success) expect(Object.keys(result.data ?? {})).toEqual(['8.8.8.8']);
  });

  it('rejects oversized batches, non-IPs and non-arrays', async () => {
    expect(await geoipLookup(Array.from({ length: 513 }, () => '8.8.8.8'))).toMatchObject({ code: 'INVALID_INPUT' });
    expect(await geoipLookup(['8.8.8.8', 'not-an-ip'])).toMatchObject({ code: 'INVALID_INPUT' });
    expect(await geoipLookup('8.8.8.8')).toMatchObject({ code: 'INVALID_INPUT' });
    expect((await geoipLookup(Array.from({ length: 512 }, () => '8.8.8.8'))).success).toBe(true);
  });

  it('is rate limited', async () => {
    for (let i = 0; i < RATE_LIMITS.geoip.burst; i++) await geoipLookup(['8.8.8.8']);
    expect(await geoipLookup(['8.8.8.8'])).toMatchObject({ code: 'RATE_LIMITED' });
  });
});
