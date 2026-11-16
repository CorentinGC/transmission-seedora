import { describe, expect, it } from 'vitest';
import { MAX_GEOIP_IPS, DEFAULT_RPC_PATH as SCHEMA_DEFAULT_PATH, serverTargetSchema } from './server/schemas';
import { DEFAULT_RPC_PATH, GEOIP_CHUNK_SIZE, chunk, toServerTarget } from './server-target';

describe('chunk', () => {
  it('splits into batches of at most the size, matching the server limit', () => {
    expect(GEOIP_CHUNK_SIZE).toBe(MAX_GEOIP_IPS);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe('DEFAULT_RPC_PATH', () => {
  it('is the same constant the server schema defaults to', () => {
    expect(DEFAULT_RPC_PATH).toBe(SCHEMA_DEFAULT_PATH);
    const parsed = serverTargetSchema.parse({ host: 'h', port: 1, useSSL: false });
    expect(parsed.path).toBe(DEFAULT_RPC_PATH);
  });
});

describe('toServerTarget', () => {
  const base = { host: 'h', port: 1, useSSL: true };
  it('normalises the path and drops empty credentials and extra fields', () => {
    expect(toServerTarget({ ...base, path: '' }).path).toBe('/transmission/rpc');
    expect(toServerTarget({ ...base, path: 'rpc' }).path).toBe('/rpc');
    expect(toServerTarget({ ...base, path: '/x', username: '', password: '' })).toEqual({
      host: 'h',
      port: 1,
      path: '/x',
      useSSL: true,
      username: undefined,
      password: undefined,
    });
    const withProxy = { ...base, path: '/x', proxyPassword: 'secret', id: 'i' };
    expect(JSON.stringify(toServerTarget(withProxy))).not.toContain('secret');
  });

  it('trims the host so a pasted trailing space does not fail validation', () => {
    expect(toServerTarget({ ...base, host: '  nas.example.com \n' }).host).toBe('nas.example.com');
  });
});

describe('toServerTarget allowSelfSigned', () => {
  const base = { host: 'h', port: 1, useSSL: true };
  it('is sent only when explicitly true on an HTTPS server', () => {
    expect(toServerTarget({ ...base, allowSelfSigned: true }).allowSelfSigned).toBe(true);
    expect(toServerTarget({ ...base, allowSelfSigned: false }).allowSelfSigned).toBeUndefined();
    expect(toServerTarget(base).allowSelfSigned).toBeUndefined();
    expect(toServerTarget({ ...base, useSSL: false, allowSelfSigned: true }).allowSelfSigned).toBeUndefined();
  });
});
