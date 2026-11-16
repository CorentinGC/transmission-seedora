import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboundError } from './errors';
import type { OutboundResponse } from './outbound';
import { RPC_METHODS, type ServerTarget } from './schemas';
import {
  DEFAULT_TIMEOUT_MS,
  LONG_TIMEOUT_MS,
  MAX_CACHED_SESSION_IDS,
  SMALL_RESPONSE_MAX_BYTES,
  callTransmission,
  clearSessionIdCache,
  maxResponseBytesForMethod,
  sessionIdCacheSize,
  timeoutForMethod,
} from './transmission';

const PASSWORD = 'hunter2-very-secret';
const target: ServerTarget = {
  host: 'nas.example.com',
  port: 9091,
  path: '/transmission/rpc',
  useSSL: false,
  username: 'alice',
  password: PASSWORD,
};

const ok = (data: unknown = { a: 1 }): OutboundResponse => ({
  status: 200,
  sessionId: undefined,
  json: { result: 'success', arguments: data },
});
const conflict = (sessionId?: string): OutboundResponse => ({ status: 409, sessionId, json: undefined });

beforeEach(() => clearSessionIdCache());

describe('timeoutForMethod', () => {
  it('uses 30 s for methods where the daemon fetches remote data and 15 s otherwise', () => {
    for (const m of ['torrent-add', 'port-test', 'blocklist-update'] as const)
      expect(timeoutForMethod(m)).toBe(LONG_TIMEOUT_MS);
    expect(timeoutForMethod('torrent-get')).toBe(DEFAULT_TIMEOUT_MS);
    expect(LONG_TIMEOUT_MS).toBe(30_000);
    expect(DEFAULT_TIMEOUT_MS).toBe(15_000);
  });
});

describe('response size per method', () => {
  it('leaves torrent-get on the outbound default and caps every other allowlisted method at 1 MiB', () => {
    expect(maxResponseBytesForMethod('torrent-get')).toBeUndefined();
    expect(SMALL_RESPONSE_MAX_BYTES).toBe(1024 * 1024);
    for (const method of RPC_METHODS.filter((m) => m !== 'torrent-get')) {
      expect(maxResponseBytesForMethod(method)).toBe(SMALL_RESPONSE_MAX_BYTES);
    }
  });

  it('passes the cap, the client key, the allowlist and onResolved to the outbound call', async () => {
    const post = vi.fn().mockResolvedValue(ok());
    const onResolved = vi.fn();
    const allowedHosts = [{ host: 'nas.example.com' }];
    await callTransmission(target, { method: 'session-get' }, 1000, {
      post,
      allowPrivate: true,
      allowedHosts,
      clientKey: 'k',
      onResolved,
    });
    expect(post.mock.calls[0][2]).toMatchObject({
      maxResponseBytes: SMALL_RESPONSE_MAX_BYTES,
      allowedHosts,
      clientKey: 'k',
      onResolved,
    });
    await callTransmission(target, { method: 'torrent-get', args: { fields: ['id'] } }, 1000, {
      post,
      allowPrivate: true,
    });
    expect(post.mock.calls[1][2].maxResponseBytes).toBeUndefined();
  });

  it('maps a malformed SEEDORA_ALLOWED_HOSTS to SERVER_MISCONFIGURED without a request', async () => {
    vi.stubEnv('SEEDORA_ALLOWED_HOSTS', 'http://bad');
    const post = vi.fn().mockResolvedValue(ok());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await callTransmission(target, { method: 'session-get' }, 1000, { post, allowPrivate: true })).toMatchObject(
      {
        success: false,
        code: 'SERVER_MISCONFIGURED',
      },
    );
    expect(post).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
});

describe('callTransmission', () => {
  it('posts to the validated target with Basic auth and the allow-private flag', async () => {
    const post = vi.fn().mockResolvedValue(ok());
    const result = await callTransmission(target, { method: 'torrent-get', args: { fields: ['id'] } }, 1000, {
      post,
      allowPrivate: true,
    });
    expect(result).toEqual({ success: true, data: { a: 1 } });
    const [outTarget, body, options] = post.mock.calls[0];
    expect(outTarget).toEqual({ host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: false });
    expect(body).toEqual({ method: 'torrent-get', arguments: { fields: ['id'] } });
    expect(options.allowPrivate).toBe(true);
    expect(options.authorization).toBe(`Basic ${Buffer.from(`alice:${PASSWORD}`).toString('base64')}`);
  });

  it('denies private hosts by default through the real outbound layer', async () => {
    const result = await callTransmission({ ...target, host: '127.0.0.1' }, { method: 'session-get' }, 1000);
    expect(result).toMatchObject({ success: false, code: 'HOST_NOT_ALLOWED' });
  });

  it('retries a 409 exactly once with the new session id and caches it', async () => {
    const post = vi.fn().mockResolvedValueOnce(conflict('abc123')).mockResolvedValueOnce(ok());
    await callTransmission(target, { method: 'session-get' }, 1000, { post });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][2].sessionId).toBeUndefined();
    expect(post.mock.calls[1][2].sessionId).toBe('abc123');

    post.mockResolvedValueOnce(ok());
    await callTransmission(target, { method: 'session-get' }, 1000, { post });
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[2][2].sessionId).toBe('abc123');
  });

  it('gives up after a second 409 and never loops', async () => {
    const post = vi.fn().mockResolvedValue(conflict('abc123'));
    const result = await callTransmission(target, { method: 'session-get' }, 1000, { post });
    expect(post).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ success: false, code: 'SESSION_ID_REJECTED' });
  });

  it('rejects a 409 without a usable session id header', async () => {
    for (const id of [undefined, '', 'bad id with space', 'x'.repeat(300)]) {
      const post = vi.fn().mockResolvedValue(conflict(id));
      const result = await callTransmission(target, { method: 'session-get' }, 1000, { post });
      expect(post).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ success: false, code: 'SESSION_ID_REJECTED' });
    }
  });

  it('does not share a session id between different credentials', async () => {
    const post = vi.fn().mockResolvedValueOnce(conflict('id-alice')).mockResolvedValue(ok());
    await callTransmission(target, { method: 'session-get' }, 1000, { post });
    post.mockClear();
    await callTransmission({ ...target, username: 'bob' }, { method: 'session-get' }, 1000, { post });
    expect(post.mock.calls[0][2].sessionId).toBeUndefined();
  });

  it('bounds the session id cache', async () => {
    const post = vi.fn().mockImplementation(async (_t, _b, o) => (o.sessionId ? ok() : conflict('sid')));
    for (let port = 1; port <= MAX_CACHED_SESSION_IDS + 20; port++) {
      await callTransmission({ ...target, port }, { method: 'session-get' }, 1000, { post });
    }
    expect(sessionIdCacheSize()).toBe(MAX_CACHED_SESSION_IDS);
  });

  it('maps statuses and daemon results to fixed codes', async () => {
    const run = (response: OutboundResponse) =>
      callTransmission(target, { method: 'session-get' }, 1000, { post: vi.fn().mockResolvedValue(response) });
    expect(await run({ status: 401, sessionId: undefined, json: undefined })).toMatchObject({ code: 'AUTH_FAILED' });
    expect(await run({ status: 500, sessionId: undefined, json: undefined })).toMatchObject({ code: 'HTTP_ERROR' });
    expect(await run({ status: 200, sessionId: undefined, json: undefined })).toMatchObject({ code: 'HTTP_ERROR' });
    expect(await run({ status: 200, sessionId: undefined, json: [] })).toMatchObject({ code: 'HTTP_ERROR' });
    expect(await run({ status: 200, sessionId: undefined, json: { result: 'no such method' } })).toEqual({
      success: false,
      error: 'no such method',
      code: 'RPC_ERROR',
    });
  });

  it('maps transport failures to their code and never leaks error text or the password', async () => {
    const timeout = vi.fn().mockRejectedValue(new OutboundError('TIMEOUT'));
    expect(await callTransmission(target, { method: 'session-get' }, 1000, { post: timeout })).toMatchObject({
      code: 'TIMEOUT',
    });

    const raw = vi.fn().mockRejectedValue(new Error(`connect ECONNREFUSED 10.0.0.5:9091 ${PASSWORD}`));
    const result = await callTransmission(target, { method: 'session-get' }, 1000, { post: raw });
    expect(result).toMatchObject({ success: false, code: 'CONNECTION_FAILED' });
    expect(JSON.stringify(result)).not.toContain(PASSWORD);
    expect(JSON.stringify(result)).not.toContain('10.0.0.5');
  });

  it('shares one deadline between the first request and the retry', async () => {
    const post = vi.fn().mockResolvedValueOnce(conflict('s1')).mockResolvedValueOnce(ok());
    await callTransmission(target, { method: 'session-get' }, 1000, { post });
    expect(post.mock.calls[0][2].signal).toBe(post.mock.calls[1][2].signal);
  });
});
