import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_ARGS_BYTES,
  MAX_ARGS_DEPTH,
  MAX_ARGS_NODES,
  MAX_GEOIP_IPS,
  RPC_METHODS,
  geoipInputSchema,
  rpcCallSchema,
  serverTargetSchema,
  sessionPayloadSchema,
} from './schemas';

const validTarget = { host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: false };

describe('serverTargetSchema', () => {
  it('accepts a minimal valid target and strips unknown keys', () => {
    const parsed = serverTargetSchema.parse({ ...validTarget, id: 'abc', name: 'NAS', proxy: { host: 'x' } });
    expect(parsed).toEqual(validTarget);
  });

  it('accepts credentials and defaults the path', () => {
    const parsed = serverTargetSchema.parse({ host: '192.168.1.5', port: 80, useSSL: true, username: 'u', password: 'p' });
    expect(parsed).toEqual({ host: '192.168.1.5', port: 80, path: '/transmission/rpc', useSSL: true, username: 'u', password: 'p' });
  });

  it.each(['::1', '2001:db8::1', '[::1]', '127.0.0.1', 'a', 'a-b.example.com', 'xn--bcher-kva.example'])(
    'accepts host %s',
    (host) => expect(serverTargetSchema.safeParse({ ...validTarget, host }).success).toBe(true),
  );

  it.each([
    '',
    ' ',
    'http://example.com',
    'user@example.com',
    'example.com/path',
    'example.com:9091',
    'exa mple.com',
    'example.com\n',
    'fe80::1%eth0',
    '-bad.example.com',
    'bad-.example.com',
    'a..b',
    'example.com.',
    'under_score.example.com',
    '[example.com]',
    '[::1',
    'a'.repeat(64) + '.com',
    ('a'.repeat(60) + '.').repeat(5) + 'com',
    'exämple.com',
    '1.2.3.4.5',
    '2130706433',
    '0x7f.1',
    '127.1',
    '0x7f000001',
  ])('rejects host %j', (host) => {
    expect(serverTargetSchema.safeParse({ ...validTarget, host }).success).toBe(false);
  });

  it.each([0, -1, 65536, 1.5, NaN, Infinity, '9091', null, undefined])('rejects port %j', (port) => {
    expect(serverTargetSchema.safeParse({ ...validTarget, port }).success).toBe(false);
  });

  it.each([1, 80, 9091, 65535])('accepts port %d (bad-port policy lives in the guard)', (port) => {
    expect(serverTargetSchema.safeParse({ ...validTarget, port }).success).toBe(true);
  });

  it.each([
    'transmission/rpc',
    '/a/../b',
    '/..',
    '/a?x=1',
    '/a#frag',
    '/a b',
    '/a\\b',
    '/%2e%2e/x',
    '/' + 'a'.repeat(256),
    '//evil.com',
    '/a\u0000b',
  ])('rejects path %j', (p) => {
    expect(serverTargetSchema.safeParse({ ...validTarget, path: p }).success).toBe(false);
  });

  it.each(['/', '/transmission/rpc', '/a.b/c_d~e/f:g@h', '/..hidden', '/a/.../b'])('accepts path %s', (p) => {
    expect(serverTargetSchema.safeParse({ ...validTarget, path: p }).success).toBe(true);
  });

  it('rejects a non-boolean useSSL and over-long credentials', () => {
    expect(serverTargetSchema.safeParse({ ...validTarget, useSSL: 'true' }).success).toBe(false);
    expect(serverTargetSchema.safeParse({ ...validTarget, useSSL: undefined }).success).toBe(false);
    expect(serverTargetSchema.safeParse({ ...validTarget, username: 'u'.repeat(257) }).success).toBe(false);
    expect(serverTargetSchema.safeParse({ ...validTarget, password: 'p'.repeat(257) }).success).toBe(false);
    expect(serverTargetSchema.safeParse({ ...validTarget, password: 'p'.repeat(256) }).success).toBe(true);
    expect(serverTargetSchema.safeParse({ ...validTarget, username: 42 }).success).toBe(false);
  });

  it.each([null, undefined, 'x', 42, [], [validTarget]])('rejects non-object input %j', (input) => {
    expect(serverTargetSchema.safeParse(input).success).toBe(false);
  });

  it('never echoes the password in validation issues', () => {
    const result = serverTargetSchema.safeParse({ ...validTarget, port: 'x', password: 'hunter2-secret' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).not.toContain('hunter2-secret');
  });
});

describe('sessionPayloadSchema', () => {
  it('requires v: 1 and keeps the target shape', () => {
    expect(sessionPayloadSchema.parse({ v: 1, ...validTarget })).toEqual({ v: 1, ...validTarget });
    expect(sessionPayloadSchema.safeParse(validTarget).success).toBe(false);
    expect(sessionPayloadSchema.safeParse({ v: 2, ...validTarget }).success).toBe(false);
    expect(sessionPayloadSchema.safeParse({ v: '1', ...validTarget }).success).toBe(false);
  });

  it('applies the same host restrictions', () => {
    expect(sessionPayloadSchema.safeParse({ v: 1, ...validTarget, host: 'http://x' }).success).toBe(false);
  });
});

describe('RPC method allowlist', () => {
  it('has exactly 24 methods', () => {
    expect(RPC_METHODS).toHaveLength(24);
    expect(new Set(RPC_METHODS).size).toBe(24);
  });

  it('matches exactly the methods web-api.ts calls', () => {
    const source = readFileSync(path.resolve(__dirname, '../web-api.ts'), 'utf8');
    const called = new Set([...source.matchAll(/rpcRequest\(\s*'([^']+)'/g)].map((m) => m[1]));
    expect(new Set(RPC_METHODS)).toEqual(called);
  });

  it.each(RPC_METHODS)('accepts %s without arguments', (method) => {
    expect(rpcCallSchema.safeParse({ method }).success).toBe(true);
  });

  it.each([
    'unknown',
    '',
    'Torrent-Get',
    'torrent-get ',
    'torrent-get\n',
    'torrent_get',
    'session-test',
    'blocklist',
    '__proto__',
    'constructor',
    'toString',
    'torrent-accept',
    'torrent-get/../x',
  ])('rejects method %j', (method) => {
    expect(rpcCallSchema.safeParse({ method }).success).toBe(false);
  });

  it.each([undefined, null, 1, {}, ['torrent-get']])('rejects non-string method %j', (method) => {
    expect(rpcCallSchema.safeParse({ method }).success).toBe(false);
  });
});

describe('RPC arguments', () => {
  /** `args` as the client sends it: a JSON string (ADR 0004 section 2). A string passes through as is. */
  const call = (args: unknown, method = 'torrent-get') =>
    rpcCallSchema.safeParse({ method, args: args === undefined ? undefined : JSON.stringify(args) });
  const callRaw = (args: unknown, method = 'torrent-get') => rpcCallSchema.safeParse({ method, args });

  it('accepts absent args and typical shapes', () => {
    expect(rpcCallSchema.safeParse({ method: 'session-stats' }).success).toBe(true);
    expect(call({ fields: ['id', 'name'], ids: [1, 2, 3] }).success).toBe(true);
    expect(call({ fields: ['id'], ids: 'recently-active' }).success).toBe(true);
    expect(call({ ids: ['0123456789abcdef0123456789abcdef01234567'] }, 'torrent-start').success).toBe(true);
    expect(call({ ids: 7 }, 'torrent-stop').success).toBe(true);
    expect(call({ ids: [1], 'delete-local-data': true }, 'torrent-remove').success).toBe(true);
    expect(call({ ids: [1], location: '/data', move: true }, 'torrent-set-location').success).toBe(true);
    expect(call({ 'download-dir': '/data', metainfo: 'AAAA', paused: false }, 'torrent-add').success).toBe(true);
    expect(call({ group: ['a', 'b'] }, 'group-get').success).toBe(true);
  });

  it('keeps unknown daemon keys (the daemon validates its own semantics)', () => {
    const parsed = rpcCallSchema.parse({ method: 'session-set', args: JSON.stringify({ 'speed-limit-down': 100, nested: { a: [1, null] } }) });
    expect(parsed.args).toEqual({ 'speed-limit-down': 100, nested: { a: [1, null] } });
  });

  it.each([
    ['array', '[1,2]'],
    ['string', '"x"'],
    ['number', '5'],
    ['null', 'null'],
    ['not JSON', '{nope'],
    ['empty', ''],
  ])('rejects non-object JSON text: %s', (_label, text) => {
    expect(callRaw(text).success).toBe(false);
  });

  it.each([
    ['object', { fields: ['id'] }],
    ['array', [1, 2]],
    ['Map', new Map()],
    ['number', 5],
    ['null', null],
  ])('rejects args that are not a string (no object ever reaches JSON.stringify): %s', (_label, args) => {
    expect(callRaw(args).success).toBe(false);
  });

  it('normalises like JSON.stringify: undefined values are dropped, NaN and Infinity become null', () => {
    const parsed = rpcCallSchema.parse({
      method: 'torrent-set',
      args: JSON.stringify({ ids: [1], sequentialDownload: undefined, 'speed-limit-down': NaN, ratio: Infinity, nested: { gone: undefined, kept: 1 }, fn: () => 1, sym: Symbol('x') }),
    });
    expect(parsed.args).toEqual({ ids: [1], 'speed-limit-down': null, ratio: null, nested: { kept: 1 } });
    expect(parsed.args).not.toHaveProperty('sequentialDownload');
  });

  it('validates well-known keys after normalisation', () => {
    expect(call({ ids: [1], paused: undefined }, 'torrent-add').success).toBe(true);
    expect(call({ ids: [Number.NaN] }).success).toBe(false);
  });

  it('allows a filename of 64 KiB (a magnet link) but not more', () => {
    expect(call({ filename: 'm'.repeat(64 * 1024) }, 'torrent-add').success).toBe(true);
    expect(call({ filename: 'm'.repeat(64 * 1024 + 1) }, 'torrent-add').success).toBe(false);
    expect(call({ location: 'x'.repeat(4097) }, 'torrent-set-location').success).toBe(false);
  });

  it('rejects a prototype-pollution key', () => {
    expect(callRaw('{"__proto__": {"polluted": true}}').success).toBe(false);
    expect(callRaw('{"a":{"__proto__":{"polluted":true}}}').success).toBe(false);
  });

  it('rejects malformed ids', () => {
    expect(call({ ids: {} }).success).toBe(false);
    expect(call({ ids: [1.5] }).success).toBe(false);
    expect(call({ ids: [-1] }).success).toBe(false);
    expect(call({ ids: [null] }).success).toBe(false);
    expect(call({ ids: [{}] }).success).toBe(false);
    expect(call({ ids: 'x'.repeat(65) }).success).toBe(false);
    expect(call({ ids: true }).success).toBe(false);
  });

  it('rejects malformed fields, flags and long strings', () => {
    expect(call({ fields: 'id' }).success).toBe(false);
    expect(call({ fields: [1] }).success).toBe(false);
    expect(call({ fields: ['x'.repeat(65)] }).success).toBe(false);
    expect(call({ fields: Array.from({ length: 129 }, () => 'id') }).success).toBe(false);
    expect(call({ ids: [1], 'delete-local-data': 'yes' }, 'torrent-remove').success).toBe(false);
    expect(call({ ids: [1], move: 1 }, 'torrent-set-location').success).toBe(false);
    expect(call({ ids: [1], location: 'x'.repeat(4097) }, 'torrent-set-location').success).toBe(false);
    expect(call({ path: 5 }, 'free-space').success).toBe(false);
    expect(call({ group: [1] }, 'group-get').success).toBe(false);
  });

  it('caps the serialised args at 1 MiB', () => {
    expect(MAX_ARGS_BYTES).toBe(1024 * 1024);
    const overhead = JSON.stringify({ metainfo: '' }).length;
    const fits = 'a'.repeat(MAX_ARGS_BYTES - overhead);
    expect(call({ metainfo: fits }, 'torrent-add').success).toBe(true);
    expect(call({ metainfo: fits + 'a' }, 'torrent-add').success).toBe(false);
  });

  it('counts bytes, not characters', () => {
    const overhead = JSON.stringify({ metainfo: '' }).length;
    const chars = Math.floor((MAX_ARGS_BYTES - overhead) / 3) + 1;
    expect(call({ metainfo: '€'.repeat(chars) }, 'torrent-add').success).toBe(false);
  });

  it('rejects absurdly deep nesting iteratively, without throwing or logging', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const text = '{"a":'.repeat(5000) + '1' + '}'.repeat(5000);
    expect(() => callRaw(text)).not.toThrow();
    expect(callRaw(text).success).toBe(false);
    expect(callRaw('['.repeat(200_000)).success).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('accepts nesting up to the depth limit and refuses one level more', () => {
    const nest = (levels: number) => '{"a":'.repeat(levels) + '1' + '}'.repeat(levels);
    expect(callRaw(nest(MAX_ARGS_DEPTH - 1)).success).toBe(true);
    expect(callRaw(nest(MAX_ARGS_DEPTH + 1)).success).toBe(false);
  });

  it('refuses a document with more nodes than the budget', () => {
    expect(callRaw(JSON.stringify({ a: new Array(MAX_ARGS_NODES + 1).fill(0) })).success).toBe(false);
    expect(callRaw(JSON.stringify({ a: new Array(1000).fill(0) })).success).toBe(true);
  });

  it('rejects a shared-reference DAG built in JS in under 50 ms, whether sent as an object or its text', () => {
    const levels = 40;
    let node: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < levels; i++) node = { a: node, b: node };
    const started = performance.now();
    expect(callRaw(node).success).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('caps the text length before parsing it', () => {
    expect(callRaw(`{"a":"${'x'.repeat(MAX_ARGS_BYTES)}"}`).success).toBe(false);
  });
});

describe('geoipInputSchema', () => {
  it('accepts IPv4 and IPv6, and deduplicates', () => {
    expect(geoipInputSchema.parse(['1.1.1.1', '2001:db8::1', '1.1.1.1'])).toEqual(['1.1.1.1', '2001:db8::1']);
    expect(geoipInputSchema.parse([])).toEqual([]);
  });

  it('accepts exactly 512 entries and rejects 513', () => {
    expect(MAX_GEOIP_IPS).toBe(512);
    const ips = (n: number) => Array.from({ length: n }, (_, i) => `10.${i >> 8}.${i & 255}.1`);
    expect(geoipInputSchema.safeParse(ips(512)).success).toBe(true);
    expect(geoipInputSchema.safeParse(ips(513)).success).toBe(false);
  });

  it('caps the raw array, so duplicates cannot smuggle a huge payload', () => {
    expect(geoipInputSchema.safeParse(Array.from({ length: 513 }, () => '1.1.1.1')).success).toBe(false);
  });

  it.each([['not-an-ip'], [''], ['1.1.1.1 '], ['999.1.1.1'], ['example.com'], ['1.1.1.1/24'], [1], [null], ['fe80::1%eth0']])(
    'rejects %j',
    (...input) => {
      expect(geoipInputSchema.safeParse(input).success).toBe(false);
    },
  );

  it('rejects non-arrays', () => {
    expect(geoipInputSchema.safeParse('1.1.1.1').success).toBe(false);
    expect(geoipInputSchema.safeParse({ 0: '1.1.1.1' }).success).toBe(false);
    expect(geoipInputSchema.safeParse(undefined).success).toBe(false);
  });
});
