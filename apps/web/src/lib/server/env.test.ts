import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfigError,
  DEV_SECRET_SLOT,
  assertServerConfig,
  getAllowPrivateHosts,
  getAllowedHosts,
  isListedHost,
  getCookieSecrets,
  getTrustProxyHeaders,
  isProduction,
} from './env';

const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(40);
const slot = globalThis as { [DEV_SECRET_SLOT]?: string };

beforeEach(() => {
  delete slot[DEV_SECRET_SLOT];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete slot[DEV_SECRET_SLOT];
});

describe('getCookieSecrets in production', () => {
  const prod = { NODE_ENV: 'production' };

  it('returns the configured secret', () => {
    expect(getCookieSecrets({ ...prod, COOKIE_SECRET: SECRET_A })).toEqual({ current: SECRET_A });
  });

  it.each([undefined, ''])('throws ConfigError when COOKIE_SECRET is %j', (value) => {
    expect(() => getCookieSecrets({ ...prod, COOKIE_SECRET: value })).toThrow(ConfigError);
  });

  it('throws on a secret shorter than 32 characters without echoing it', () => {
    const short = 'short-but-secret-value';
    try {
      getCookieSecrets({ ...prod, COOKIE_SECRET: short });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as Error).message).not.toContain(short);
    }
  });

  it('never falls back to a generated secret', () => {
    expect(() => getCookieSecrets(prod)).toThrow(ConfigError);
    expect(slot[DEV_SECRET_SLOT]).toBeUndefined();
  });

  it('exposes the previous secret for rotation', () => {
    expect(getCookieSecrets({ ...prod, COOKIE_SECRET: SECRET_A, COOKIE_SECRET_PREVIOUS: SECRET_B })).toEqual({
      current: SECRET_A,
      previous: SECRET_B,
    });
  });

  it('ignores an empty or identical previous secret', () => {
    expect(getCookieSecrets({ ...prod, COOKIE_SECRET: SECRET_A, COOKIE_SECRET_PREVIOUS: '' })).toEqual({
      current: SECRET_A,
    });
    expect(getCookieSecrets({ ...prod, COOKIE_SECRET: SECRET_A, COOKIE_SECRET_PREVIOUS: SECRET_A })).toEqual({
      current: SECRET_A,
    });
  });

  it('throws on a short previous secret without echoing it', () => {
    const short = 'old-short-secret';
    try {
      getCookieSecrets({ ...prod, COOKIE_SECRET: SECRET_A, COOKIE_SECRET_PREVIOUS: short });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as Error).message).not.toContain(short);
    }
  });
});

describe('getCookieSecrets outside production', () => {
  it.each(['development', 'test', undefined])('generates a random secret when NODE_ENV is %j', (NODE_ENV) => {
    const { current } = getCookieSecrets({ NODE_ENV });
    expect(current.length).toBeGreaterThanOrEqual(32);
  });

  it('keeps the same secret for the process and warns once, without printing it', () => {
    const first = getCookieSecrets({ NODE_ENV: 'development' }).current;
    const second = getCookieSecrets({ NODE_ENV: 'development' }).current;
    expect(second).toBe(first);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(first);
  });

  it('generates a different secret in a new process', () => {
    const first = getCookieSecrets({ NODE_ENV: 'development' }).current;
    delete slot[DEV_SECRET_SLOT];
    expect(getCookieSecrets({ NODE_ENV: 'development' }).current).not.toBe(first);
  });

  it('prefers a configured secret and does not generate one', () => {
    expect(getCookieSecrets({ NODE_ENV: 'development', COOKIE_SECRET: SECRET_A })).toEqual({ current: SECRET_A });
    expect(slot[DEV_SECRET_SLOT]).toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('still rejects a set but short secret', () => {
    expect(() => getCookieSecrets({ NODE_ENV: 'development', COOKIE_SECRET: 'short' })).toThrow(ConfigError);
  });
});

describe('flags', () => {
  it('only the exact string "true" enables SEEDORA_ALLOW_PRIVATE_HOSTS', () => {
    expect(getAllowPrivateHosts({ SEEDORA_ALLOW_PRIVATE_HOSTS: 'true' })).toBe(true);
    for (const v of [undefined, '', '1', 'TRUE', 'True', 'yes', ' true', 'true ']) {
      expect(getAllowPrivateHosts({ SEEDORA_ALLOW_PRIVATE_HOSTS: v })).toBe(false);
    }
  });

  it('only the exact string "true" enables SEEDORA_TRUST_PROXY_HEADERS', () => {
    expect(getTrustProxyHeaders({ SEEDORA_TRUST_PROXY_HEADERS: 'true' })).toBe(true);
    for (const v of [undefined, '', '1', 'TRUE', 'yes']) {
      expect(getTrustProxyHeaders({ SEEDORA_TRUST_PROXY_HEADERS: v })).toBe(false);
    }
  });

  it('isProduction is true only for NODE_ENV=production', () => {
    expect(isProduction({ NODE_ENV: 'production' })).toBe(true);
    expect(isProduction({ NODE_ENV: 'development' })).toBe(false);
    expect(isProduction({})).toBe(false);
  });
});

describe('assertServerConfig', () => {
  it('throws in production without a secret and passes with one', () => {
    expect(() => assertServerConfig({ NODE_ENV: 'production' })).toThrow(ConfigError);
    expect(() => assertServerConfig({ NODE_ENV: 'production', COOKIE_SECRET: SECRET_A })).not.toThrow();
  });

  it('warns once, without addresses, when private hosts are allowed', () => {
    assertServerConfig({ NODE_ENV: 'production', COOKIE_SECRET: SECRET_A, SEEDORA_ALLOW_PRIVATE_HOSTS: 'true' });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(SECRET_A);
  });

  it('does not warn by default', () => {
    assertServerConfig({ NODE_ENV: 'production', COOKIE_SECRET: SECRET_A });
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe('getAllowedHosts (f3u)', () => {
  it('is null when unset or blank', () => {
    expect(getAllowedHosts({})).toBeNull();
    expect(getAllowedHosts({ SEEDORA_ALLOWED_HOSTS: '' })).toBeNull();
    expect(getAllowedHosts({ SEEDORA_ALLOWED_HOSTS: '  ' })).toBeNull();
  });

  it('parses host, host:port, IPv4 and IPv6 entries, trimmed and lowercased', () => {
    expect(
      getAllowedHosts({
        SEEDORA_ALLOWED_HOSTS: ' NAS.lan , nas2.lan:9091,192.168.1.5,192.168.1.6:8080,[fd00::1],[fd00::2]:9091,fd00::3',
      }),
    ).toEqual([
      { host: 'nas.lan' },
      { host: 'nas2.lan', port: 9091 },
      { host: '192.168.1.5' },
      { host: '192.168.1.6', port: 8080 },
      { host: 'fd00::1' },
      { host: 'fd00::2', port: 9091 },
      { host: 'fd00::3' },
    ]);
  });

  it.each([
    ['empty entry', 'nas.lan,,x.lan'],
    ['scheme', 'http://nas.lan'],
    ['path', 'nas.lan/rpc'],
    ['userinfo', 'a@nas.lan'],
    ['port 0', 'nas.lan:0'],
    ['port too large', 'nas.lan:65536'],
    ['non numeric port', 'nas.lan:http'],
    ['wildcard', '*.lan'],
    ['unclosed bracket', '[fd00::1'],
    ['garbage after bracket', '[fd00::1]x'],
    ['zone id', '[fe80::1%eth0]'],
    ['numeric host', '2130706433'],
  ])('rejects a malformed entry without echoing it: %s', (_label, value) => {
    let message = '';
    try {
      getAllowedHosts({ SEEDORA_ALLOWED_HOSTS: value });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      message = (error as Error).message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain(value);
  });
});

describe('isListedHost', () => {
  const list = [{ host: 'nas.lan' }, { host: 'other.lan', port: 9091 }];
  it('matches case-insensitively, and on the port only when the entry has one', () => {
    expect(isListedHost(list, 'NAS.lan', 1234)).toBe(true);
    expect(isListedHost(list, 'other.lan', 9091)).toBe(true);
    expect(isListedHost(list, 'other.lan', 80)).toBe(false);
    expect(isListedHost(list, 'nas.lan.evil.test', 80)).toBe(false);
    expect(isListedHost([], 'nas.lan', 80)).toBe(false);
  });
});

describe('assertServerConfig and SEEDORA_ALLOWED_HOSTS', () => {
  const base = { NODE_ENV: 'production', COOKIE_SECRET: SECRET_A };
  it('fails the boot on a malformed list', () => {
    expect(() => assertServerConfig({ ...base, SEEDORA_ALLOWED_HOSTS: 'http://x' })).toThrow(ConfigError);
  });

  it('says whether the list limits private hosts or has no effect', () => {
    assertServerConfig({ ...base, SEEDORA_ALLOW_PRIVATE_HOSTS: 'true', SEEDORA_ALLOWED_HOSTS: 'nas.lan' });
    expect(String(vi.mocked(console.warn).mock.calls[0]?.[0])).toContain('SEEDORA_ALLOWED_HOSTS only');
    vi.mocked(console.warn).mockClear();
    assertServerConfig({ ...base, SEEDORA_ALLOWED_HOSTS: 'nas.lan' });
    expect(String(vi.mocked(console.warn).mock.calls[0]?.[0])).toContain('no effect');
  });
});
