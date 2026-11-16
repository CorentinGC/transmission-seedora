import { describe, expect, it } from 'vitest';
import type { ServerConfig } from '@shared/types';
import { resolveTestServer, toPublicServer, withoutSecrets, withSecrets } from './server-credentials';

const stored: ServerConfig = {
  id: 's1',
  name: 'n',
  host: 'nas',
  port: 9091,
  path: '/transmission/rpc',
  useSSL: false,
  username: 'u',
  password: 'pw',
  proxyType: 'http',
  proxyHost: 'p',
  proxyPort: 3128,
  proxyUsername: 'pu',
  proxyPassword: 'ppw',
  hasPassword: true,
  hasProxyPassword: true,
};
const { password: _p, proxyPassword: _pp, hasPassword: _h1, hasProxyPassword: _h2, ...form } = stored;

describe('toPublicServer', () => {
  it('drops both passwords and keeps the flags', () => {
    const pub = toPublicServer(stored);
    expect(JSON.stringify(pub)).not.toContain('pw');
    expect(pub).toMatchObject({ hasPassword: true, hasProxyPassword: true, username: 'u' });
  });

  it('derives the flags when the store did not set them', () => {
    expect(toPublicServer({ ...form, password: 'x' })).toMatchObject({ hasPassword: true, hasProxyPassword: false });
  });
});

describe('export helpers', () => {
  it('withoutSecrets drops passwords and flags, withSecrets keeps passwords only', () => {
    expect(withoutSecrets(stored)).toEqual({ ...form });
    expect(withSecrets(stored)).toMatchObject({ password: 'pw', proxyPassword: 'ppw' });
    expect(withSecrets(stored)).not.toHaveProperty('hasPassword');
  });
});

describe('resolveTestServer', () => {
  it('uses the stored passwords when the endpoint and proxy are unchanged', () => {
    expect(resolveTestServer(form, stored)).toMatchObject({ password: 'pw', proxyPassword: 'ppw' });
    expect(resolveTestServer({ ...form, password: '', proxyPassword: '' }, stored)).toMatchObject({
      password: 'pw',
      proxyPassword: 'ppw',
    });
  });

  it('prefers a password typed in the form', () => {
    expect(resolveTestServer({ ...form, password: 'typed' }, stored).password).toBe('typed');
  });

  it.each([
    ['host', { host: 'evil.example' }],
    ['port', { port: 1 }],
    ['path', { path: '/x' }],
    ['useSSL', { useSSL: true }],
  ])('never sends the stored password to another %s', (_name, change) => {
    const result = resolveTestServer({ ...form, ...change }, stored);
    expect(result.password).toBeUndefined();
    expect(result.proxyPassword).toBe('ppw');
  });

  it('never sends the stored proxy password to another proxy', () => {
    expect(resolveTestServer({ ...form, proxyHost: 'evil' }, stored).proxyPassword).toBeUndefined();
    expect(resolveTestServer({ ...form, proxyType: 'socks5' }, stored).proxyPassword).toBeUndefined();
  });

  it('never sends the stored proxy password under another proxy username', () => {
    expect(resolveTestServer({ ...form, proxyUsername: 'other' }, stored).proxyPassword).toBeUndefined();
  });

  it('never sends the stored password once certificate checks are relaxed', () => {
    expect(resolveTestServer({ ...form, allowSelfSigned: true }, stored).password).toBeUndefined();
    expect(resolveTestServer({ ...form, allowSelfSigned: false }, stored).password).toBe('pw');
    expect(resolveTestServer({ ...form, allowSelfSigned: true }, { ...stored, allowSelfSigned: true }).password).toBe(
      'pw',
    );
  });

  it('uses no stored secret for a new server or an unknown id', () => {
    const { id: _id, ...newServer } = form;
    expect(resolveTestServer(newServer, stored)).toMatchObject({ id: 'test', password: undefined });
    expect(resolveTestServer({ ...form, id: 'other' }, stored).password).toBeUndefined();
    expect(resolveTestServer(form, undefined).password).toBeUndefined();
  });
});
