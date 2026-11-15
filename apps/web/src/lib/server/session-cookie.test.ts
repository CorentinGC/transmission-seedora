import { sealData } from 'iron-session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigError, DEV_SECRET_SLOT } from './env';
import {
  LEGACY_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  SESSION_TTL_SECONDS,
  getSessionCookieName,
  getSessionCookieOptions,
  sealSession,
  unsealSession,
} from './session-cookie';

const SECRET = 'current-secret-0123456789-abcdefghij';
const OLD_SECRET = 'previous-secret-0123456789-abcdefghi';
const OTHER_SECRET = 'unrelated-secret-0123456789-abcdefgh';
const PROD = { NODE_ENV: 'production', COOKIE_SECRET: SECRET };
const slot = globalThis as { [DEV_SECRET_SLOT]?: string };

const target = {
  host: 'nas.example.com',
  port: 9091,
  path: '/transmission/rpc',
  useSSL: true,
  username: 'alice',
  password: 'hunter2-very-secret',
};

/** Seals an arbitrary payload exactly like the real code would, to test shape validation. */
function sealRaw(payload: unknown, secret = SECRET): Promise<string> {
  // The id must be what secretId derives: seal through the public helper's key space by reusing sealSession is
  // impossible for invalid payloads, so mirror the derivation here.
  return import('node:crypto').then(({ createHash }) => {
    const digest = createHash('sha256').update(`seedora-session-id:${secret}`).digest();
    const id = (digest.readUInt32BE(0) & 0x7fffffff) || 1;
    return sealData(payload as object, { password: { [id]: secret }, ttl: SESSION_TTL_SECONDS });
  });
}

beforeEach(() => {
  delete slot[DEV_SECRET_SLOT];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete slot[DEV_SECRET_SLOT];
});

describe('roundtrip', () => {
  it('seals and unseals a full target', async () => {
    const sealed = await sealSession(target, PROD);
    expect(await unsealSession(sealed, PROD)).toEqual({ v: 1, ...target });
  });

  it('works without credentials and defaults the path', async () => {
    const sealed = await sealSession({ host: '10.0.0.2', port: 80, useSSL: false }, PROD);
    expect(await unsealSession(sealed, PROD)).toEqual({
      v: 1,
      host: '10.0.0.2',
      port: 80,
      path: '/transmission/rpc',
      useSSL: false,
    });
  });

  it('stores nothing beyond the payload: no id, name or proxy fields', async () => {
    const sealed = await sealSession({ ...target, id: 'x', name: 'NAS', proxy: { host: 'p' } }, PROD);
    expect(Object.keys((await unsealSession(sealed, PROD)) ?? {}).sort()).toEqual(
      ['host', 'password', 'path', 'port', 'useSSL', 'username', 'v'],
    );
  });

  it('keeps the worst-case payload under the 4096-byte cookie limit', async () => {
    const worst = { host: ('a'.repeat(60) + '.').repeat(3) + 'com', port: 65535, path: '/' + 'a'.repeat(255), useSSL: true, username: '€'.repeat(256), password: '€'.repeat(256) };
    const sealed = await sealSession(worst, PROD);
    expect(Buffer.byteLength(sealed)).toBeLessThanOrEqual(4096);
    expect(await unsealSession(sealed, PROD)).toMatchObject({ host: worst.host });
  });

  it('is unreadable without the secret: neither host nor password appear in the cookie value', async () => {
    const sealed = await sealSession(target, PROD);
    expect(sealed).not.toContain('nas.example.com');
    expect(sealed).not.toContain('hunter2');
    expect(sealed).not.toContain(Buffer.from(JSON.stringify(target)).toString('base64').slice(0, 20));
  });

  it('produces a different value on each seal', async () => {
    expect(await sealSession(target, PROD)).not.toBe(await sealSession(target, PROD));
  });
});

describe('sealing input', () => {
  it.each([
    ['bad host', { ...target, host: 'http://evil' }],
    ['bad port', { ...target, port: 0 }],
    ['bad path', { ...target, path: '/../x' }],
    ['not an object', 'x'],
    ['null', null],
  ])('refuses to seal %s, with a message free of the input', async (_l, input) => {
    await expect(sealSession(input, PROD)).rejects.toThrow('Invalid session target');
  });

  it('never puts the password in the refusal message', async () => {
    try {
      await sealSession({ ...target, port: 'x' }, PROD);
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain(target.password);
    }
  });
});

describe('tampering and forgery', () => {
  it('rejects a cookie whose characters are changed anywhere', async () => {
    const sealed = await sealSession(target, PROD);
    for (const index of [0, 10, Math.floor(sealed.length / 3), Math.floor(sealed.length / 2), sealed.length - 10, sealed.length - 1]) {
      const original = sealed[index];
      const flipped = original === 'A' ? 'B' : 'A';
      const tampered = sealed.slice(0, index) + flipped + sealed.slice(index + 1);
      expect(await unsealSession(tampered, PROD)).toBeNull();
    }
  });

  it('rejects truncated and extended values', async () => {
    const sealed = await sealSession(target, PROD);
    expect(await unsealSession(sealed.slice(0, -5), PROD)).toBeNull();
    const delimiter = sealed.lastIndexOf('~');
    expect(await unsealSession(sealed.slice(0, delimiter) + 'AAAA' + sealed.slice(delimiter), PROD)).toBeNull();
    expect(await unsealSession('AAAA' + sealed, PROD)).toBeNull();
    expect(await unsealSession(sealed.slice(0, 20), PROD)).toBeNull();
  });

  it.each([
    undefined,
    '',
    'x',
    'Fe26.2**',
    '{"host":"evil","port":80}',
    Buffer.from(JSON.stringify({ host: 'evil.example', port: 80, path: '/x', useSSL: false })).toString('base64'),
    'a'.repeat(5000),
  ])('reads %j as no session', async (value) => {
    expect(await unsealSession(value, PROD)).toBeNull();
  });

  it('rejects a cookie sealed with a different secret', async () => {
    const sealed = await sealSession(target, { ...PROD, COOKIE_SECRET: OTHER_SECRET });
    expect(await unsealSession(sealed, PROD)).toBeNull();
  });

  it('rejects a validly sealed payload with the wrong version or shape', async () => {
    const good = { v: 1, host: 'nas.example.com', port: 9091, path: '/x', useSSL: false };
    expect(await unsealSession(await sealRaw(good), PROD)).toEqual(good);
    for (const bad of [
      { ...good, v: 2 },
      { host: good.host, port: good.port, path: good.path, useSSL: false },
      { ...good, host: 'http://evil.example' },
      { ...good, host: '127.0.0.1:22' },
      { ...good, port: '9091' },
      { ...good, port: 70000 },
      { ...good, path: '/a/../b' },
      { ...good, useSSL: 'true' },
      { ...good, password: 42 },
      {},
      [],
    ]) {
      expect(await unsealSession(await sealRaw(bad), PROD)).toBeNull();
    }
  });

  it('strips unknown keys from a validly sealed payload', async () => {
    const good = { v: 1, host: 'nas.example.com', port: 9091, path: '/x', useSSL: false };
    const read = await unsealSession(await sealRaw({ ...good, isAdmin: true }), PROD);
    expect(read).toEqual(good);
  });

  it('never treats the legacy base64 cookie as a session', async () => {
    const legacy = Buffer.from(JSON.stringify({ host: 'nas.example.com', port: 9091, path: '/x', useSSL: false })).toString('base64');
    expect(await unsealSession(legacy, PROD)).toBeNull();
    expect(LEGACY_COOKIE_NAME).toBe('seedora_server');
  });
});

describe('expiry', () => {
  it('reads as no session after the 7-day TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const sealed = await sealSession(target, PROD);
    vi.setSystemTime(new Date('2026-01-07T23:00:00Z'));
    expect(await unsealSession(sealed, PROD)).not.toBeNull();
    vi.setSystemTime(new Date('2026-01-08T00:05:00Z'));
    expect(await unsealSession(sealed, PROD)).toBeNull();
  });
});

describe('rotation', () => {
  const rotated = { NODE_ENV: 'production', COOKIE_SECRET: SECRET, COOKIE_SECRET_PREVIOUS: OLD_SECRET };

  it('reads a cookie sealed with the previous secret while it is configured', async () => {
    const sealedWithOld = await sealSession(target, { NODE_ENV: 'production', COOKIE_SECRET: OLD_SECRET });
    expect(await unsealSession(sealedWithOld, rotated)).toEqual({ v: 1, ...target });
  });

  it('rejects the old cookie once the previous secret is removed', async () => {
    const sealedWithOld = await sealSession(target, { NODE_ENV: 'production', COOKIE_SECRET: OLD_SECRET });
    expect(await unsealSession(sealedWithOld, PROD)).toBeNull();
  });

  it('always seals with the current secret', async () => {
    const sealed = await sealSession(target, rotated);
    expect(await unsealSession(sealed, PROD)).toEqual({ v: 1, ...target });
    expect(await unsealSession(sealed, { NODE_ENV: 'production', COOKIE_SECRET: OLD_SECRET })).toBeNull();
  });

  it('does not accept a cookie sealed with an unrelated secret', async () => {
    const sealed = await sealSession(target, { NODE_ENV: 'production', COOKIE_SECRET: OTHER_SECRET });
    expect(await unsealSession(sealed, rotated)).toBeNull();
  });
});

describe('configuration failures', () => {
  it.each([{ NODE_ENV: 'production' }, { NODE_ENV: 'production', COOKIE_SECRET: 'too-short' }])(
    'throws ConfigError in production for %j',
    async (env) => {
      await expect(sealSession(target, env)).rejects.toBeInstanceOf(ConfigError);
      await expect(unsealSession('anything', env)).rejects.toBeInstanceOf(ConfigError);
    },
  );

  it('reads a missing cookie as ConfigError too when the secret is missing, so misconfiguration is not hidden', async () => {
    await expect(unsealSession(undefined, { NODE_ENV: 'production' })).rejects.toBeInstanceOf(ConfigError);
  });

  it('uses a random per-process secret in development', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const dev = { NODE_ENV: 'development' };
    const sealed = await sealSession(target, dev);
    expect(await unsealSession(sealed, dev)).toEqual({ v: 1, ...target });
    delete slot[DEV_SECRET_SLOT];
    expect(await unsealSession(sealed, dev)).toBeNull();
  });
});

describe('no secret leakage', () => {
  it('logs nothing and never exposes secrets or the password in errors', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const messages: string[] = [];
    const sealed = await sealSession(target, { ...PROD, COOKIE_SECRET_PREVIOUS: OLD_SECRET });
    await unsealSession(sealed, PROD);
    await unsealSession(sealed.slice(0, -3), PROD);
    for (const attempt of [
      () => sealSession(target, { NODE_ENV: 'production', COOKIE_SECRET: 'tiny' }),
      () => sealSession({ ...target, host: 'bad host' }, PROD),
      () => unsealSession(sealed, { NODE_ENV: 'production' }),
    ]) {
      try {
        await attempt();
      } catch (err) {
        messages.push(String((err as Error).message));
      }
    }
    expect(messages.length).toBe(3);
    const all = messages.join('\n');
    for (const secret of [SECRET, OLD_SECRET, target.password, 'tiny']) {
      expect(all).not.toContain(secret);
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('cookie attributes', () => {
  it('uses the __Host- prefix and Secure in production', () => {
    expect(getSessionCookieName({ NODE_ENV: 'production' })).toBe('__Host-seedora-session');
    expect(getSessionCookieOptions({ NODE_ENV: 'production' })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_TTL_SECONDS - 60,
    });
  });

  it('drops the prefix and Secure in development, keeping httpOnly and strict', () => {
    expect(getSessionCookieName({ NODE_ENV: 'development' })).toBe('seedora-session');
    const options = getSessionCookieOptions({ NODE_ENV: 'development' });
    expect(options).toMatchObject({ httpOnly: true, secure: false, sameSite: 'strict', path: '/' });
    expect(options).not.toHaveProperty('domain');
    expect(options.maxAge).toBe(SESSION_COOKIE_MAX_AGE);
  });

  it('has a 7-day TTL', () => {
    expect(SESSION_TTL_SECONDS).toBe(604800);
  });
});
