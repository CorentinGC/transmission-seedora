import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OutboundError, type ErrorCode } from './errors';
import {
  createPinnedLookup,
  MAX_RESPONSE_BYTES,
  postJson,
  resolveAndValidate,
  type OutboundTarget,
  type Resolver,
} from './outbound';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void;

let server: http.Server;
let port: number;
let handler: Handler;
let requests: { host: string | undefined; headers: http.IncomingHttpHeaders; body: string; url: string }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      requests.push({ host: req.headers.host, headers: req.headers, body, url: req.url ?? '' });
      handler(req, res, body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  requests = [];
  handler = (_req, res) => res.end('{}');
});

const target = (over: Partial<OutboundTarget> = {}): OutboundTarget => ({
  host: '127.0.0.1',
  port: 0,
  path: '/transmission/rpc',
  useSSL: false,
  ...over,
});
const local = (over: Partial<OutboundTarget> = {}) => target({ port, ...over });
const neverCalled = (): Resolver => vi.fn(async () => { throw new Error('resolver must not run'); });

async function codeOf(promise: Promise<unknown>): Promise<ErrorCode> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(OutboundError);
    return (error as OutboundError).code;
  }
  throw new Error('expected rejection');
}

describe('postJson: policy before any I/O', () => {
  it.each(['127.0.0.1', '[::1]', '::1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '100.64.0.1', '169.254.1.1', '::ffff:127.0.0.1', '0.0.0.0'])(
    'refuses IP literal %s by default without connecting or resolving',
    async (host) => {
      const resolver = neverCalled();
      expect(await codeOf(postJson(local({ host }), {}, { allowPrivate: false, resolver }))).toBe('HOST_NOT_ALLOWED');
      expect(resolver).not.toHaveBeenCalled();
      expect(requests).toHaveLength(0);
    },
  );

  it.each(['169.254.169.254', '[fd00:ec2::254]', '100.100.100.200', '0.0.0.0', '::', '::ffff:169.254.169.254', '64:ff9b::7f00:1'])(
    'refuses %s even with allowPrivate',
    async (host) => {
      expect(await codeOf(postJson(local({ host }), {}, { allowPrivate: true, resolver: neverCalled() }))).toBe('HOST_NOT_ALLOWED');
      expect(requests).toHaveLength(0);
    },
  );

  it.each([25, 22, 6667, 21])('refuses bad port %d before resolving', async (p) => {
    const resolver = neverCalled();
    expect(await codeOf(postJson(target({ host: 'daemon.example', port: p }), {}, { allowPrivate: true, resolver }))).toBe('HOST_NOT_ALLOWED');
    expect(resolver).not.toHaveBeenCalled();
  });

  it.each([0, 65536, -1, 1.5, NaN])('rejects invalid port %d as INVALID_INPUT', async (p) => {
    const resolver = neverCalled();
    expect(await codeOf(postJson(target({ host: 'daemon.example', port: p }), {}, { allowPrivate: true, resolver }))).toBe('INVALID_INPUT');
    expect(resolver).not.toHaveBeenCalled();
  });

  it.each([
    ['host with scheme', { host: 'http://evil.example' }],
    ['host with userinfo', { host: 'a@evil.example' }],
    ['host with space', { host: 'evil .example' }],
    ['empty host', { host: '' }],
    ['zone id', { host: 'fe80::1%eth0' }],
    ['path with CRLF', { path: '/x\r\nHost: evil' }],
    ['path with query', { path: '/rpc?x=1' }],
    ['path without slash', { path: 'rpc' }],
  ])('rejects %s', async (_name, over) => {
    const resolver = neverCalled();
    expect(await codeOf(postJson(local(over), {}, { allowPrivate: true, resolver }))).toBe('INVALID_INPUT');
    expect(resolver).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);
  });

  it('rejects header values with control characters', async () => {
    const opts = { allowPrivate: true, resolver: neverCalled() };
    expect(await codeOf(postJson(local(), {}, { ...opts, sessionId: 'a\r\nX-Evil: 1' }))).toBe('INVALID_INPUT');
    expect(await codeOf(postJson(local(), {}, { ...opts, authorization: 'Basic x\nY' }))).toBe('INVALID_INPUT');
  });

  it('rejects a body that cannot be serialised', async () => {
    expect(await codeOf(postJson(local(), undefined, { allowPrivate: true }))).toBe('INVALID_INPUT');
  });

  it('does not accept 2130706433 or 0x7f.1 as a way to reach loopback (system resolver)', async () => {
    for (const host of ['2130706433', '0x7f.1']) {
      const code = await codeOf(postJson(local({ host }), {}, { allowPrivate: false }));
      expect(['HOST_NOT_ALLOWED', 'DNS_FAILED']).toContain(code);
    }
    expect(requests).toHaveLength(0);
  });
});

describe('resolveAndValidate', () => {
  const signal = () => new AbortController().signal;

  it('allows a name resolving only to public addresses', async () => {
    const resolver: Resolver = async () => [{ address: '93.184.216.34', family: 4 }, { address: '2606:4700::1111', family: 6 }];
    await expect(resolveAndValidate('example.org', false, resolver, signal())).resolves.toHaveLength(2);
  });

  it('refuses a name resolving to a private address', async () => {
    const resolver: Resolver = async () => [{ address: '10.0.0.5', family: 4 }];
    expect(await codeOf(resolveAndValidate('lan.example', false, resolver, signal()))).toBe('HOST_NOT_ALLOWED');
  });

  it('refuses one public plus one private address, in either order', async () => {
    for (const list of [
      [{ address: '93.184.216.34', family: 4 as const }, { address: '127.0.0.1', family: 4 as const }],
      [{ address: '::1', family: 6 as const }, { address: '93.184.216.34', family: 4 as const }],
    ]) {
      expect(await codeOf(resolveAndValidate('mixed.example', false, async () => list, signal()))).toBe('HOST_NOT_ALLOWED');
    }
  });

  it('allows private answers with the opt-in but never metadata', async () => {
    const lan: Resolver = async () => [{ address: '192.168.1.10', family: 4 }];
    await expect(resolveAndValidate('nas.example', true, lan, signal())).resolves.toHaveLength(1);
    const meta: Resolver = async () => [{ address: '192.168.1.10', family: 4 }, { address: '169.254.169.254', family: 4 }];
    expect(await codeOf(resolveAndValidate('nas.example', true, meta, signal()))).toBe('HOST_NOT_ALLOWED');
  });

  it('maps resolver failures and empty answers to DNS_FAILED without leaking the message', async () => {
    const boom: Resolver = async () => { throw new Error('getaddrinfo ENOTFOUND secret.internal'); };
    expect(await codeOf(resolveAndValidate('x.example', false, boom, signal()))).toBe('DNS_FAILED');
    expect(await codeOf(resolveAndValidate('x.example', false, async () => [], signal()))).toBe('DNS_FAILED');
  });

  it('times out on a resolver that never settles', async () => {
    const hang: Resolver = () => new Promise(() => undefined);
    expect(await codeOf(resolveAndValidate('x.example', false, hang, AbortSignal.timeout(30)))).toBe('TIMEOUT');
  });

  it('does not call the resolver for an IP literal and still classifies it', async () => {
    const resolver = neverCalled();
    expect(await codeOf(resolveAndValidate('127.0.0.1', false, resolver, signal()))).toBe('HOST_NOT_ALLOWED');
    await expect(resolveAndValidate('1.1.1.1', false, resolver, signal())).resolves.toEqual([{ address: '1.1.1.1', family: 4 }]);
  });
});

describe('createPinnedLookup', () => {
  const addrs = [{ address: '93.184.216.34', family: 4 as const }, { address: '2606:4700::1111', family: 6 as const }];

  it('answers all:true with the validated addresses only', () => {
    const cb = vi.fn();
    createPinnedLookup(addrs)('whatever.example', { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, addrs);
  });

  it('answers the single shape with the first matching address', () => {
    const cb = vi.fn();
    createPinnedLookup(addrs)('whatever.example', {}, cb);
    expect(cb).toHaveBeenCalledWith(null, '93.184.216.34', 4);
    const cb6 = vi.fn();
    createPinnedLookup(addrs)('whatever.example', { family: 6 }, cb6);
    expect(cb6).toHaveBeenCalledWith(null, '2606:4700::1111', 6);
  });

  it('fails instead of falling back when no validated address matches the family', () => {
    const cb = vi.fn();
    createPinnedLookup([addrs[0]])('whatever.example', { family: 6 }, cb);
    expect(cb.mock.calls[0][0]).toMatchObject({ code: 'ENOTFOUND' });
  });
});

describe('postJson: connection', () => {
  it('connects to an allowed loopback literal and returns status, session id and JSON', async () => {
    handler = (_req, res) => {
      res.setHeader('x-transmission-session-id', 'abc');
      res.end('{"result":"success"}');
    };
    const res = await postJson(local(), { method: 'session-get' }, { allowPrivate: true, authorization: 'Basic eDp5', sessionId: 'sid' });
    expect(res).toEqual({ status: 200, sessionId: 'abc', json: { result: 'success' } });
    expect(requests[0].body).toBe('{"method":"session-get"}');
    expect(requests[0].headers.authorization).toBe('Basic eDp5');
    expect(requests[0].headers['x-transmission-session-id']).toBe('sid');
    expect(requests[0].headers['content-type']).toBe('application/json');
    expect(requests[0].url).toBe('/transmission/rpc');
  });

  it('returns non-2xx statuses (409 handshake) and tolerates non-JSON bodies', async () => {
    handler = (_req, res) => {
      res.statusCode = 409;
      res.setHeader('x-transmission-session-id', 'new');
      res.end('<html>409</html>');
    };
    expect(await postJson(local(), {}, { allowPrivate: true })).toEqual({ status: 409, sessionId: 'new', json: undefined });
  });

  it('pins the connection to the validated address and keeps the Host header (rebinding)', async () => {
    let calls = 0;
    const resolver = vi.fn<Resolver>(async () => {
      calls += 1;
      return calls === 1 ? [{ address: '127.0.0.1', family: 4 as const }] : [{ address: '10.0.0.1', family: 4 as const }];
    });
    const res = await postJson(target({ host: 'rebind.example', port }), {}, { allowPrivate: true, resolver });
    expect(res.status).toBe(200);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(requests[0].host).toBe(`rebind.example:${port}`);
  });

  it('refuses a rebinding host whose first answer is private, without a second resolution', async () => {
    const resolver = vi.fn<Resolver>(async () => [{ address: '127.0.0.1', family: 4 }]);
    expect(await codeOf(postJson(target({ host: 'rebind.example', port }), {}, { allowPrivate: false, resolver }))).toBe('HOST_NOT_ALLOWED');
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(0);
  });

  it.each([301, 302, 303, 307, 308])('does not follow a %d redirect', async (status) => {
    let hits = 0;
    handler = (_req, res) => {
      hits += 1;
      res.statusCode = status;
      res.setHeader('location', `http://127.0.0.1:${port}/elsewhere`);
      res.end();
    };
    expect(await codeOf(postJson(local(), {}, { allowPrivate: true }))).toBe('UNEXPECTED_REDIRECT');
    expect(hits).toBe(1);
  });

  it('times out on a server that never answers', async () => {
    handler = () => undefined;
    expect(await codeOf(postJson(local(), {}, { allowPrivate: true, signal: AbortSignal.timeout(80) }))).toBe('TIMEOUT');
  });

  it('times out on a server that stalls mid-body', async () => {
    handler = (_req, res) => {
      res.writeHead(200);
      res.write('{"a":');
    };
    expect(await codeOf(postJson(local(), {}, { allowPrivate: true, signal: AbortSignal.timeout(80) }))).toBe('TIMEOUT');
  });

  it('refuses a pre-aborted signal without resolving', async () => {
    const resolver = neverCalled();
    expect(await codeOf(postJson(target({ host: 'x.example', port }), {}, { allowPrivate: true, resolver, signal: AbortSignal.abort() }))).toBe('TIMEOUT');
    expect(resolver).not.toHaveBeenCalled();
  });

  it('aborts a chunked body that exceeds the cap', async () => {
    handler = (_req, res) => {
      res.writeHead(200);
      res.write('x'.repeat(600));
      res.write('x'.repeat(600));
    };
    expect(await codeOf(postJson(local(), {}, { allowPrivate: true, maxResponseBytes: 1000 }))).toBe('RESPONSE_TOO_LARGE');
  });

  it('rejects a declared content-length above the cap', async () => {
    handler = (_req, res) => {
      res.setHeader('content-length', '5000');
      res.end('x'.repeat(5000));
    };
    expect(await codeOf(postJson(local(), {}, { allowPrivate: true, maxResponseBytes: 1000 }))).toBe('RESPONSE_TOO_LARGE');
  });

  it('enforces the 32 MiB cap and ignores an override that raises it', async () => {
    handler = (_req, res) => {
      res.writeHead(200);
      const chunk = Buffer.alloc(1024 * 1024, 120);
      for (let i = 0; i < 33; i++) res.write(chunk);
    };
    expect(MAX_RESPONSE_BYTES).toBe(33554432);
    expect(await codeOf(postJson(local(), {}, { allowPrivate: true, maxResponseBytes: Number.MAX_SAFE_INTEGER, signal: AbortSignal.timeout(10_000) }))).toBe('RESPONSE_TOO_LARGE');
  });

  it('maps a refused connection to CONNECTION_FAILED with a fixed message', async () => {
    const closed = http.createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const closedPort = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));
    const error = await postJson(target({ port: closedPort, host: '127.0.0.1' }), {}, { allowPrivate: true, authorization: 'Basic c2VjcmV0' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OutboundError);
    expect((error as OutboundError).code).toBe('CONNECTION_FAILED');
    expect((error as OutboundError).message).not.toMatch(/127\.0\.0\.1|ECONNREFUSED|c2VjcmV0|\d{4,}/);
    expect((error as OutboundError).cause).toBeUndefined();
  });

  it('maps TLS against a plain HTTP server to TLS_FAILED (not a successful connection)', async () => {
    const code = await codeOf(postJson(local({ useSSL: true }), {}, { allowPrivate: true, signal: AbortSignal.timeout(3000) }));
    expect(['TLS_FAILED', 'CONNECTION_FAILED']).toContain(code);
  });
});
