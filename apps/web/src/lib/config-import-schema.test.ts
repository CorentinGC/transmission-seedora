import { describe, expect, it } from 'vitest';
import { importDataSchema } from './config-import-schema';

const server = { name: 'A', host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: true };

describe('importDataSchema', () => {
  it('accepts an empty backup and a valid one', () => {
    expect(importDataSchema.safeParse({}).success).toBe(true);
    expect(importDataSchema.safeParse({ servers: [server], preferences: { theme: 'dark' } }).success).toBe(true);
  });

  it('accepts hostnames, IPv4 and bracketed IPv6 hosts', () => {
    for (const host of ['a.b-c_d', '192.168.1.2', '[::1]', '[fe80::1]']) {
      expect(importDataSchema.safeParse({ servers: [{ ...server, host }] }).success).toBe(true);
    }
  });

  it.each([
    ['host with slash', { host: 'a/b' }],
    ['host with at sign', { host: 'user@evil.com' }],
    ['host with space', { host: 'a b' }],
    ['empty host', { host: '' }],
    ['unbracketed ipv6', { host: '::1' }],
    ['port 0', { port: 0 }],
    ['port 65536', { port: 65536 }],
    ['fractional port', { port: 1.5 }],
    ['string port', { port: '9091' }],
    ['path with query', { path: '/rpc?x=1' }],
    ['path with fragment', { path: '/rpc#x' }],
    ['relative path', { path: 'rpc' }],
    ['path with backslash', { path: '/a\\b' }],
    ['name too long', { name: 'x'.repeat(201) }],
    ['string useSSL', { useSSL: 'true' }],
    ['bad proxyType', { proxyType: 'ftp' }],
    ['password too long', { password: 'x'.repeat(2001) }],
    ['proxyPort out of range', { proxyPort: 70000 }],
  ])('rejects the whole payload on %s', (_label, patch) => {
    expect(importDataSchema.safeParse({ servers: [server, { ...server, ...patch }] }).success).toBe(false);
  });

  it('rejects more than 1000 servers and a non-array servers value', () => {
    expect(importDataSchema.safeParse({ servers: Array(1001).fill(server) }).success).toBe(false);
    expect(importDataSchema.safeParse({ servers: Array(1000).fill(server) }).success).toBe(true);
    expect(importDataSchema.safeParse({ servers: 'x' }).success).toBe(false);
    expect(importDataSchema.safeParse(null).success).toBe(false);
    expect(importDataSchema.safeParse([]).success).toBe(false);
  });

  it('strips allowSelfSigned and unknown keys from servers', () => {
    const parsed = importDataSchema.parse({ servers: [{ ...server, id: 'x', allowSelfSigned: true, extra: 1 }] });
    expect(parsed.servers?.[0]).not.toHaveProperty('allowSelfSigned');
    expect(parsed.servers?.[0]).not.toHaveProperty('extra');
  });

  it('rejects invalid preference values but drops unknown preference keys', () => {
    expect(importDataSchema.safeParse({ preferences: { pollingInterval: 1 } }).success).toBe(false);
    expect(importDataSchema.safeParse({ preferences: { theme: 'neon' } }).success).toBe(false);
    expect(importDataSchema.safeParse({ preferences: { pathMappings: 'x' } }).success).toBe(false);
    const parsed = importDataSchema.parse({ preferences: { theme: 'dark', bogus: 1 } });
    expect(parsed.preferences).toEqual({ theme: 'dark' });
  });
});
