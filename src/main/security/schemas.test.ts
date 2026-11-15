import { describe, expect, it } from 'vitest';
import {
  geoipIpsSchema,
  importRequestSchema,
  newServerSchema,
  notificationSchema,
  openDirectoryRequestSchema,
  prefsPatchSchema,
  resolveOpenPreset,
  rpcParamsWithoutIdsSchema,
  serverUpdateSchema,
  torrentAddSchema,
} from './schemas';

const server = { name: 'n', host: 'h', port: 9091, path: '/transmission/rpc', useSSL: false };

describe('schemas', () => {
  it('accepts what the server form sends (undefined optionals)', () => {
    expect(newServerSchema.safeParse({ ...server, username: undefined, proxyType: 'none', proxyPort: undefined }).success).toBe(true);
  });

  it('rejects unknown keys on SERVER_UPDATE and PREFS_SET', () => {
    expect(serverUpdateSchema.safeParse({ host: 'x' }).success).toBe(true);
    expect(serverUpdateSchema.safeParse({ host: 'x', id: 'other' }).success).toBe(false);
    expect(serverUpdateSchema.safeParse({ __proto__x: 1 }).success).toBe(false);
    expect(prefsPatchSchema.safeParse({ theme: 'dark' }).success).toBe(true);
    expect(prefsPatchSchema.safeParse({ theme: 'dark', evil: true }).success).toBe(false);
    expect(prefsPatchSchema.safeParse({ pollingInterval: 'fast' }).success).toBe(false);
  });

  it('rejects out-of-range server values', () => {
    expect(newServerSchema.safeParse({ ...server, port: 70000 }).success).toBe(false);
    expect(newServerSchema.safeParse({ ...server, host: '' }).success).toBe(false);
  });

  it('keeps ids out of torrent-set params', () => {
    expect(rpcParamsWithoutIdsSchema.safeParse({ downloadLimit: 5 }).success).toBe(true);
    expect(rpcParamsWithoutIdsSchema.safeParse({ downloadLimit: 5, ids: [1] }).success).toBe(false);
    expect(rpcParamsWithoutIdsSchema.safeParse({ downloadLimit: 5, 'bad key!': 1 }).success).toBe(false);
  });

  it('accepts undefined values in RPC bags and truncates notification text', () => {
    expect(rpcParamsWithoutIdsSchema.safeParse({ a: undefined, b: 1 }).success).toBe(true);
    const parsed = notificationSchema.parse({ title: 't'.repeat(500), body: 'b' });
    expect(parsed.title).toHaveLength(200);
  });

  it('allowlists torrent-add keys', () => {
    expect(torrentAddSchema.safeParse({ filename: 'magnet:?xt=urn:btih:abc', paused: false }).success).toBe(true);
    expect(torrentAddSchema.safeParse({ filename: 'x', 'download-dir': undefined }).success).toBe(true);
    expect(torrentAddSchema.safeParse({ filename: 'x', somethingElse: 1 }).success).toBe(false);
  });

  it('de-duplicates and truncates GeoIP lookups instead of rejecting them', () => {
    expect(geoipIpsSchema.parse(Array(2000).fill('1.1.1.1'))).toEqual(['1.1.1.1']);
    const many = Array.from({ length: 700 }, (_, i) => `10.0.${Math.floor(i / 256)}.${i % 256}`);
    expect(geoipIpsSchema.parse(many)).toHaveLength(512);
    expect(geoipIpsSchema.safeParse(['x'.repeat(65)]).success).toBe(false);
  });

  it('drops explicit undefined keys so a patch cannot erase stored values', () => {
    const update = serverUpdateSchema.parse({ host: undefined, port: 1234 });
    expect('host' in update).toBe(false);
    expect(update).toEqual({ port: 1234 });
    const prefs = prefsPatchSchema.parse({ theme: undefined, language: 'fr' });
    expect(prefs).toEqual({ language: 'fr' });
  });

  it('accepts hostnames, IPv4 and bracketed IPv6 only as server host', () => {
    for (const host of ['localhost', 'nas.local', 'my_box-1.example.com', '192.168.1.10', '[::1]', '[fe80::1]', '[::ffff:1.2.3.4]']) {
      expect(newServerSchema.safeParse({ ...server, host }).success, host).toBe(true);
    }
    for (const host of ['user@evil.com', 'evil.com/path', 'evil.com#x', 'evil.com?x=1', 'a b', 'a\tb', '::1', '[::1]:80', '[fe80::1%en0]', 'a:80', 'a\\b']) {
      expect(newServerSchema.safeParse({ ...server, host }).success, host).toBe(false);
    }
  });

  it('restricts the RPC path to an absolute, query-free path', () => {
    for (const path of ['/', '/transmission/rpc', '/a.b_c~d-e/']) {
      expect(newServerSchema.safeParse({ ...server, path }).success, path).toBe(true);
    }
    for (const path of ['', 'transmission/rpc', '/a?b=1', '/a#b', '/a b', '/a\\b', '/x%2e']) {
      expect(newServerSchema.safeParse({ ...server, path }).success, path).toBe(false);
    }
  });

  it('accepts an optional purpose on the directory dialog request', () => {
    expect(openDirectoryRequestSchema.safeParse(undefined).success).toBe(true);
    expect(openDirectoryRequestSchema.safeParse({ purpose: 'watch-folder' }).success).toBe(true);
    expect(openDirectoryRequestSchema.safeParse({ purpose: 'other' }).success).toBe(false);
    expect(openDirectoryRequestSchema.safeParse({ properties: ['openFile'] }).success).toBe(false);
  });

  it('accepts both import shapes but not a mix of filePath and unknown keys', () => {
    expect(importRequestSchema.safeParse({ filePath: '/a.json' }).success).toBe(true);
    expect(importRequestSchema.safeParse({ servers: [server] }).success).toBe(true);
    expect(importRequestSchema.safeParse({ servers: [{ host: 1 }] }).success).toBe(false);
  });

  it('resolves dialog presets from fixed values only', () => {
    expect(resolveOpenPreset(undefined)).toBe('torrent');
    expect(resolveOpenPreset({ preset: 'json' })).toBe('json');
    expect(resolveOpenPreset({ properties: ['openDirectory'], filters: [{ extensions: ['JSON'] }] })).toBe('json');
    expect(resolveOpenPreset({ properties: ['openDirectory'], filters: [{ extensions: ['*'] }] })).toBe('torrent');
  });
});

describe('proxyHost and password-clear flags', () => {
  it('accepts a hostname, an IPv6 literal and an empty proxy host', () => {
    for (const proxyHost of ['proxy.lan', '10.0.0.1', '[::1]', '']) expect(serverUpdateSchema.safeParse({ proxyHost }).success).toBe(true);
  });

  it('rejects a proxy host that could change the proxy URL', () => {
    for (const proxyHost of ['evil.com/x', 'a b', 'u:p@host', 'host?x=1', 'a#b']) expect(serverUpdateSchema.safeParse({ proxyHost }).success).toBe(false);
  });

  it('accepts clearPassword flags on update only', () => {
    expect(serverUpdateSchema.parse({ clearPassword: true, clearProxyPassword: true })).toEqual({ clearPassword: true, clearProxyPassword: true });
    expect(newServerSchema.safeParse({ ...server, clearPassword: true }).success).toBe(false);
  });
});
