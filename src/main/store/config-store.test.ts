import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerConfig } from '@shared/types';
import { ConfigStoreError, createConfigStore } from './config-store';
import type { SecretCrypto } from './secret-crypto';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() }, safeStorage: {} }));

const server: ServerConfig = { id: 's1', name: 'n', host: 'nas', port: 9091, path: '/transmission/rpc', useSSL: false };

let dir: string;
let file: string;
let available: boolean;
let failDecrypt: boolean;
let failEncrypt: boolean;
let availabilityFails: boolean;
let reEncrypt: boolean;

const fakeCrypto: SecretCrypto = {
  isAvailable: async () => {
    if (availabilityFails) throw new Error('no store');
    return available;
  },
  encrypt: async (plain) => {
    if (failEncrypt) throw new Error('encryption failed');
    return Buffer.from(`enc:${plain}`).toString('base64');
  },
  decrypt: async (b64) => {
    if (failDecrypt) throw new Error('keychain locked');
    return { value: Buffer.from(b64, 'base64').toString().replace(/^enc:/, ''), shouldReEncrypt: reEncrypt };
  },
};
/** Opens a store and runs the async startup (availability check and decryption), as `ready` does. */
const open = async () => {
  const store = createConfigStore({ filePath: () => file, crypto: fakeCrypto, now: () => 1234 });
  await store.init();
  return store;
};
const onDisk = () => fs.readFileSync(file, 'utf-8');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-store-'));
  file = path.join(dir, 'config.json');
  available = true;
  failDecrypt = false;
  failEncrypt = false;
  availabilityFails = false;
  reEncrypt = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('patches', () => {
  it('does not erase a server field when the patch carries an explicit undefined', async () => {
    const store = await open();
    await store.addServer(server);
    await store.updateServer('s1', { host: undefined, port: 1234 });
    expect(store.getServers()[0]).toMatchObject({ host: 'nas', port: 1234 });
  });

  it('does not erase a preference when the patch carries an explicit undefined', async () => {
    const store = await open();
    await store.updatePreferences({ language: 'fr' });
    await store.updatePreferences({ language: undefined, theme: 'dark' });
    expect(store.getPreferences()).toMatchObject({ language: 'fr', theme: 'dark' });
  });
});

describe('credential encryption', () => {
  it('writes no cleartext password, round-trips it and creates the file with mode 0600', async () => {
    const store = await open();
    await store.addServer({ ...server, password: 'hunter2', proxyPassword: 'proxy-secret' });
    expect(onDisk()).not.toContain('hunter2');
    expect(onDisk()).not.toContain('proxy-secret');
    expect(store.getServers()[0]).toMatchObject({
      password: 'hunter2',
      proxyPassword: 'proxy-secret',
      hasPassword: true,
      hasProxyPassword: true,
    });
    if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it('leaves no temp file behind and tightens an existing 0644 file', async () => {
    fs.writeFileSync(file, JSON.stringify({ servers: [], preferences: {} }), { mode: 0o644 });
    await (await open()).addServer(server);
    expect(fs.readdirSync(dir)).toEqual(['config.json']);
    if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it('encrypts legacy cleartext passwords at startup without any other write', async () => {
    fs.writeFileSync(
      file,
      JSON.stringify({ servers: [{ ...server, password: 'legacy-pw' }], activeServerId: null, preferences: {} }),
    );
    await (await open()).migrateLegacySecrets();
    expect(onDisk()).not.toContain('legacy-pw');
    expect((await open()).getServers()[0]?.password).toBe('legacy-pw');
  });

  it('leaves cleartext untouched when no secret store exists', async () => {
    available = false;
    fs.writeFileSync(
      file,
      JSON.stringify({ servers: [{ ...server, password: 'legacy-pw' }], activeServerId: null, preferences: {} }),
    );
    await (await open()).migrateLegacySecrets();
    expect(onDisk()).toContain('legacy-pw');
  });

  it('migrates a legacy cleartext config on the first write', async () => {
    fs.writeFileSync(
      file,
      JSON.stringify({ servers: [{ ...server, password: 'legacy-pw' }], activeServerId: 's1', preferences: {} }),
    );
    const store = await open();
    expect(store.getServers()[0]?.password).toBe('legacy-pw');
    await store.setActiveServerId('s1');
    expect(onDisk()).not.toContain('legacy-pw');
    expect((await open()).getServers()[0]?.password).toBe('legacy-pw');
  });

  it('keeps a password in the 0600 file when no secret store exists, and encrypts it once one does', async () => {
    available = false;
    const store = await open();
    await store.addServer({ ...server, password: 'pw' });
    expect(onDisk()).toContain('"password": "pw"');
    available = true;
    const reopened = await open();
    await reopened.migrateLegacySecrets();
    expect(onDisk()).not.toContain('"pw"');
    expect(reopened.getServers()[0]?.password).toBe('pw');
  });

  it('keeps a server whose password cannot be decrypted and preserves the ciphertext on later writes', async () => {
    await (await open()).addServer({ ...server, password: 'pw' });
    failDecrypt = true;
    const store = await open();
    expect(store.getServers()[0]).toMatchObject({ id: 's1', hasPassword: true });
    expect(store.getServers()[0]?.password).toBeUndefined();
    await store.updateServer('s1', { name: 'renamed' });
    failDecrypt = false;
    expect((await open()).getServers()[0]).toMatchObject({ name: 'renamed', password: 'pw' });
  });
});

describe('async secret store', () => {
  it('fails closed: a failed encryption writes nothing and never leaves the secret in cleartext on disk', async () => {
    const store = await open();
    failEncrypt = true;
    await expect(store.addServer({ ...server, password: 'pw' })).rejects.toThrow(ConfigStoreError);
    expect(fs.existsSync(file)).toBe(false);
    expect(store.getServers()).toEqual([]);
    failEncrypt = false;
    await store.setActiveServerId(null);
    expect(onDisk()).not.toContain('"pw"');
    expect((await open()).getServers()).toEqual([]);
  });

  it('treats an availability error as no secret store', async () => {
    availabilityFails = true;
    const store = await open();
    expect(store.isSecretStorageEncrypted()).toBe(false);
  });

  it('reads encrypted passwords as locked until init has run', async () => {
    await (await open()).addServer({ ...server, password: 'pw' });
    const store = createConfigStore({ filePath: () => file, crypto: fakeCrypto });
    expect(store.getServers()[0]).toMatchObject({ hasPassword: true });
    expect(store.getServers()[0]?.password).toBeUndefined();
  });

  it('re-encrypts a secret the OS asks to refresh', async () => {
    await (await open()).addServer({ ...server, password: 'pw' });
    const before = onDisk();
    reEncrypt = true;
    const store = await open();
    expect(store.getServers()[0]?.password).toBe('pw');
    await store.migrateLegacySecrets();
    reEncrypt = false;
    expect(onDisk()).not.toContain('"pw"');
    expect((await open()).getServers()[0]?.password).toBe('pw');
    expect(onDisk()).toContain('passwordEnc');
    expect(before).toContain('passwordEnc');
  });

  it('decrypts a ciphertext written by a previous version (base64 of the safeStorage blob)', async () => {
    fs.writeFileSync(
      file,
      JSON.stringify({
        servers: [{ ...server, passwordEnc: Buffer.from('enc:legacy').toString('base64') }],
        preferences: {},
      }),
    );
    expect((await open()).getServers()[0]?.password).toBe('legacy');
  });

  it('serialises concurrent writes', async () => {
    const store = await open();
    await Promise.all([
      store.addServer({ ...server, password: 'a' }),
      store.addServer({ ...server, id: 's2', password: 'b' }),
      store.updatePreferences({ theme: 'dark' }),
    ]);
    const reopened = await open();
    expect(reopened.getServers().map((s) => s.password)).toEqual(['a', 'b']);
    expect(reopened.getPreferences().theme).toBe('dark');
    expect(onDisk()).not.toMatch(/"password":/);
  });
});

describe('password update rules', () => {
  const withPasswords = async () => {
    const store = await open();
    await store.addServer({
      ...server,
      username: 'u',
      password: 'pw',
      proxyType: 'http',
      proxyHost: 'p',
      proxyPort: 3128,
      proxyPassword: 'ppw',
    });
    return store;
  };

  it('keeps the stored passwords when the patch omits them or sends an empty string', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { name: 'x', password: '', proxyPassword: '' });
    expect(store.getServers()[0]).toMatchObject({ password: 'pw', proxyPassword: 'ppw' });
  });

  it('replaces a password when a new one is sent', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { password: 'new' });
    expect(store.getServers()[0]?.password).toBe('new');
  });

  it('drops the password when the host or port changes, unless a new one comes along', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { host: 'other' });
    expect(store.getServers()[0]).toMatchObject({ hasPassword: false, hasProxyPassword: true });
    await store.updateServer('s1', { password: 'again' });
    await store.updateServer('s1', { port: 1, password: 'fresh' });
    expect(store.getServers()[0]?.password).toBe('fresh');
    await store.updateServer('s1', { port: 2 });
    expect(store.getServers()[0]?.hasPassword).toBe(false);
  });

  it('removes a password only on an explicit clear request, keeping the username', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { clearPassword: true });
    expect(store.getServers()[0]).toMatchObject({ username: 'u', hasPassword: false, hasProxyPassword: true });
    await store.updateServer('s1', { clearProxyPassword: true });
    expect(store.getServers()[0]).toMatchObject({ hasProxyPassword: false });
    expect(onDisk()).not.toContain('clearPassword');
  });

  it('drops the password when TLS is switched off or the RPC path changes', async () => {
    let store = await open();
    await store.addServer({ ...server, useSSL: true, username: 'u', password: 'pw' });
    await store.updateServer('s1', { useSSL: false });
    expect(store.getServers()[0]?.hasPassword).toBe(false);
    await store.updateServer('s1', { password: 'pw' });
    store = await open();
    await store.updateServer('s1', { path: '/other/rpc' });
    expect(store.getServers()[0]?.hasPassword).toBe(false);
  });

  it.each([
    ['proxy host', { proxyHost: 'evil' }],
    ['proxy type', { proxyType: 'socks5' as const }],
    ['proxy port', { proxyPort: 1 }],
    ['proxy username', { proxyUsername: 'other' }],
  ])('drops both passwords when the %s changes', async (_name, change) => {
    const store = await withPasswords();
    await store.updateServer('s1', change);
    expect(store.getServers()[0]).toMatchObject({ hasProxyPassword: false, hasPassword: false });
  });

  it('keeps a password supplied in the same patch as a proxy change', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { proxyHost: 'new', password: 'fresh', proxyPassword: 'pfresh' });
    expect(store.getServers()[0]).toMatchObject({ password: 'fresh', proxyPassword: 'pfresh' });
  });

  it('keeps the daemon password when the proxy is switched off', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { proxyType: 'none' });
    expect(store.getServers()[0]).toMatchObject({ hasPassword: true, hasProxyPassword: false });
  });

  it('drops the password when certificate checks are relaxed, not when they are tightened', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { allowSelfSigned: true });
    expect(store.getServers()[0]?.hasPassword).toBe(false);
    await store.updateServer('s1', { password: 'pw' });
    await store.updateServer('s1', { allowSelfSigned: false });
    expect(store.getServers()[0]?.password).toBe('pw');
  });

  it('reports servers whose password cannot be decrypted', async () => {
    await (await open()).addServer({ ...server, name: 'NAS', password: 'pw' });
    failDecrypt = true;
    expect((await open()).getLockedServerNames()).toEqual(['NAS']);
    failDecrypt = false;
    expect((await open()).getLockedServerNames()).toEqual([]);
  });

  it('keeps the password when the host is re-sent unchanged', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { host: 'nas', port: 9091, name: 'same' });
    expect(store.getServers()[0]?.password).toBe('pw');
  });

  it('drops the proxy password when the proxy changes or is turned off, and the password when the username is emptied', async () => {
    const store = await withPasswords();
    await store.updateServer('s1', { proxyHost: 'elsewhere' });
    expect(store.getServers()[0]?.hasProxyPassword).toBe(false);
    await store.updateServer('s1', { proxyPassword: 'p2' });
    await store.updateServer('s1', { proxyType: 'none' });
    expect(store.getServers()[0]?.hasProxyPassword).toBe(false);
    await store.updateServer('s1', { username: '' });
    expect(store.getServers()[0]?.hasPassword).toBe(false);
  });
});

describe('load failures', () => {
  it('moves a corrupt file aside (mode 0600), reports it and keeps working', async () => {
    fs.writeFileSync(file, '{"servers": [ {"id": "x", "password": "secret"', { mode: 0o644 });
    const store = await open();
    expect(store.getServers()).toEqual([]);
    expect(store.getLoadError()).toEqual({ kind: 'corrupt', backupPath: `${file}.corrupt-1234` });
    expect(fs.readFileSync(`${file}.corrupt-1234`, 'utf-8')).toContain('"secret"');
    if (process.platform !== 'win32') expect(fs.statSync(`${file}.corrupt-1234`).mode & 0o777).toBe(0o600);
    await store.addServer(server);
    expect((await open()).getServers()).toHaveLength(1);
    expect(fs.existsSync(`${file}.corrupt-1234`)).toBe(true);
  });

  it('treats valid JSON of the wrong shape as corrupt', async () => {
    fs.writeFileSync(file, '[1,2,3]');
    expect((await open()).getLoadError()?.kind).toBe('corrupt');
  });

  it('starts silently on a missing file', async () => {
    const store = await open();
    expect(store.getServers()).toEqual([]);
    expect(store.getLoadError()).toBeUndefined();
  });

  it('refuses to overwrite a file it cannot read', async () => {
    fs.mkdirSync(file); // reading a directory fails with EISDIR
    const store = await open();
    expect(store.getLoadError()).toEqual({ kind: 'unreadable' });
    await expect(store.addServer(server)).rejects.toThrow(ConfigStoreError);
    expect(fs.statSync(file).isDirectory()).toBe(true);
  });

  it('backs up once, not on every read', async () => {
    fs.writeFileSync(file, 'nope');
    const store = await open();
    store.getServers();
    store.getPreferences();
    store.getActiveServerId();
    expect(fs.readdirSync(dir)).toEqual(['config.json.corrupt-1234']);
  });
});

describe('stored preferences', () => {
  it('drops removed or invalid preference keys instead of failing, keeping the valid ones', async () => {
    fs.writeFileSync(
      file,
      JSON.stringify({
        servers: [],
        preferences: {
          language: 'fr',
          confirmOnAdd: true,
          pathMappings: [],
          pollingInterval: 5,
          theme: 'dark',
          bogus: 1,
        },
      }),
    );
    const store = await open();
    expect(store.getLoadError()).toBeUndefined();
    const prefs = store.getPreferences();
    expect(prefs).toMatchObject({ language: 'fr', theme: 'dark', pollingInterval: 3000 });
    expect(prefs).not.toHaveProperty('confirmOnAdd');
    expect(prefs).not.toHaveProperty('pathMappings');
    expect(prefs).not.toHaveProperty('bogus');
    await store.updatePreferences({ showNotifications: false });
    expect(onDisk()).not.toContain('confirmOnAdd');
  });
});
