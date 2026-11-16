import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, ...args: unknown[]) => Promise<{ success: boolean; error?: string; data?: unknown }>;
const handlers = new Map<string, Handler>();

const dialogMock = vi.hoisted(() => ({ showMessageBox: vi.fn(), showSaveDialog: vi.fn() }));
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn), on: vi.fn() },
  dialog: dialogMock,
  BrowserWindow: { fromWebContents: () => null },
}));

const store = vi.hoisted(() => ({
  getServers: vi.fn(),
  addServer: vi.fn(),
  updateServer: vi.fn(),
  removeServer: vi.fn(),
  setActiveServerId: vi.fn(),
  isSecretStorageEncrypted: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));
vi.mock('../store/config-store', () => ({ configStore: store }));
const manager = vi.hoisted(() => ({
  refreshClient: vi.fn(),
  removeClient: vi.fn(),
  setActiveServer: vi.fn(),
  clearActive: vi.fn(),
  createTemporaryClient: vi.fn(),
}));
vi.mock('../rpc/connection-manager', () => ({ connectionManager: manager }));

const { IPC } = await import('@ipc/ipc-channels');
const { RpcError } = await import('../rpc/client');
const { approvedPaths } = await import('../security/approved-paths');
const { applyImport, isWatchFolderAllowed, registerConfigHandlers } = await import('./config-handlers');

const call = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler({}, ...args);
};

let dir: string;
const server = { name: 'n', host: 'nas', port: 9091, path: '/transmission/rpc', useSSL: false };

beforeAll(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-cfg-')));
  registerConfigHandlers(() => true);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  vi.clearAllMocks();
  store.getServers.mockReturnValue([]);
  store.getPreferences.mockReturnValue({ watchFolder: '/stored/folder' });
});

describe('isWatchFolderAllowed', () => {
  it('allows no value and the stored value', () => {
    expect(isWatchFolderAllowed(undefined)).toBe(true);
    expect(isWatchFolderAllowed('')).toBe(true);
    expect(isWatchFolderAllowed('/stored/folder')).toBe(true);
  });

  it('refuses a folder approved only as a generic directory, accepts a watch-folder approval', () => {
    const folder = fs.mkdtempSync(path.join(dir, 'w-'));
    approvedPaths.approve([folder], 'directory');
    expect(isWatchFolderAllowed(folder)).toBe(false);
    approvedPaths.approve([folder], 'watch-folder');
    expect(isWatchFolderAllowed(folder)).toBe(true);
  });

  it('refuses a folder that was never approved', () => {
    expect(isWatchFolderAllowed(path.join(dir, 'never'))).toBe(false);
  });
});

describe('PREFS_SET', () => {
  it('rejects an unapproved watchFolder without touching the store', async () => {
    const res = await call(IPC.PREFS_SET, { watchFolder: path.join(dir, 'evil') });
    expect(res.success).toBe(false);
    expect(store.updatePreferences).not.toHaveBeenCalled();
  });

  it('applies a patch without watchFolder and ignores explicit undefined keys', async () => {
    const res = await call(IPC.PREFS_SET, { theme: 'dark', language: undefined });
    expect(res.success).toBe(true);
    expect(store.updatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
  });
});

describe('applyImport', () => {
  it('never imports watchFolder and skips duplicate servers', async () => {
    store.getServers.mockReturnValue([{ ...server, id: 'x' }]);
    const res = await applyImport({
      servers: [server, { ...server, host: 'other' }],
      preferences: { theme: 'dark', watchFolder: '/etc' },
    });
    expect(res.data).toEqual({ serversAdded: 1, serversSkipped: 1, prefsImported: true });
    expect(store.updatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
    expect(store.addServer).toHaveBeenCalledTimes(1);
  });

  it('dedupes by host+port+path only, ignoring name, SSL and credentials', async () => {
    store.getServers.mockReturnValue([{ ...server, id: 'x' }]);
    const res = await applyImport({
      servers: [
        { ...server, name: 'renamed', useSSL: true, username: 'u', password: 'p' },
        { ...server, port: 9092 },
        { ...server, path: '/other/rpc' },
      ],
    });
    expect(res.data).toEqual({ serversAdded: 2, serversSkipped: 1, prefsImported: false });
  });

  it('dedupes duplicates inside the file itself and regenerates ids', async () => {
    const res = await applyImport({
      servers: [
        { ...server, id: 'from-file' },
        { ...server, id: 'other-id' },
      ],
    });
    expect(res.data).toEqual({ serversAdded: 1, serversSkipped: 1, prefsImported: false });
    const added = store.addServer.mock.calls[0]?.[0];
    expect(added.id).not.toBe('from-file');
    expect(added.id).toEqual(expect.any(String));
  });

  it('never replaces or removes existing servers and leaves the active server untouched', async () => {
    store.getServers.mockReturnValue([{ ...server, id: 'x' }]);
    await applyImport({ servers: [{ ...server, host: 'new' }] });
    expect(store.removeServer).not.toHaveBeenCalled();
    expect(store.updateServer).not.toHaveBeenCalled();
    expect(store.setActiveServerId).not.toHaveBeenCalled();
    expect(manager.setActiveServer).not.toHaveBeenCalled();
    expect(manager.removeClient).not.toHaveBeenCalled();
  });

  it('reports a servers-only and a preferences-only import', async () => {
    expect((await applyImport({ servers: [server] })).data).toEqual({
      serversAdded: 1,
      serversSkipped: 0,
      prefsImported: false,
    });
    expect(store.updatePreferences).not.toHaveBeenCalled();
    expect((await applyImport({ preferences: { theme: 'dark' } })).data).toEqual({
      serversAdded: 0,
      serversSkipped: 0,
      prefsImported: true,
    });
    expect(store.addServer).toHaveBeenCalledTimes(1);
  });
});

describe('CONFIG_IMPORT', () => {
  it('rejects a payload with an invalid server host (no cast through)', async () => {
    const res = await call(IPC.CONFIG_IMPORT, { servers: [{ ...server, host: 'a/b' }] });
    expect(res.success).toBe(false);
    expect(store.addServer).not.toHaveBeenCalled();
  });

  it('refuses a filePath that no dialog returned', async () => {
    const file = path.join(dir, 'unapproved.json');
    fs.writeFileSync(file, JSON.stringify({ servers: [server] }));
    const res = await call(IPC.CONFIG_IMPORT, { filePath: file });
    expect(res).toEqual({ success: false, error: 'Import failed: File was not selected through a file dialog' });
    expect(store.addServer).not.toHaveBeenCalled();
  });

  it('imports a dialog-approved file', async () => {
    const file = path.join(dir, 'approved.json');
    fs.writeFileSync(file, JSON.stringify({ servers: [server], preferences: { watchFolder: '/etc', theme: 'light' } }));
    approvedPaths.approve([file], 'json');
    const res = await call(IPC.CONFIG_IMPORT, { filePath: file });
    expect(res.success).toBe(true);
    expect(store.updatePreferences).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('reports an approved file that is not valid backup data without leaking details', async () => {
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{"servers": [{"host": 1}]}');
    approvedPaths.approve([file], 'json');
    const res = await call(IPC.CONFIG_IMPORT, { filePath: file });
    expect(res).toEqual({ success: false, error: 'Import failed: invalid file' });
  });

  it('drops allowSelfSigned from imported servers (inline data and file)', async () => {
    const risky = { ...server, useSSL: true, allowSelfSigned: true };
    expect((await call(IPC.CONFIG_IMPORT, { servers: [risky] })).success).toBe(true);
    expect(store.addServer.mock.calls[0]?.[0]).not.toHaveProperty('allowSelfSigned');

    const file = path.join(dir, 'selfsigned.json');
    fs.writeFileSync(file, JSON.stringify({ servers: [{ ...risky, host: 'other' }] }));
    approvedPaths.approve([file], 'json');
    expect((await call(IPC.CONFIG_IMPORT, { filePath: file })).success).toBe(true);
    expect(store.addServer.mock.calls[1]?.[0]).not.toHaveProperty('allowSelfSigned');
  });

  it('imports inline data', async () => {
    const res = await call(IPC.CONFIG_IMPORT, { servers: [server] });
    expect(res.success).toBe(true);
    expect(store.addServer).toHaveBeenCalledTimes(1);
  });
});

describe('SERVER_UPDATE', () => {
  it('refreshes the RPC client with the stored, merged server', async () => {
    const merged = { id: 's1', ...server, host: 'new-host' };
    store.getServers.mockReturnValue([merged]);
    const res = await call(IPC.SERVER_UPDATE, 's1', { host: 'new-host' });
    expect(res.success).toBe(true);
    expect(store.updateServer).toHaveBeenCalledWith('s1', { host: 'new-host' });
    expect(manager.refreshClient).toHaveBeenCalledWith(merged);
  });

  it('accepts allowSelfSigned and rejects non-boolean values', async () => {
    store.getServers.mockReturnValue([{ id: 's1', ...server }]);
    expect((await call(IPC.SERVER_UPDATE, 's1', { allowSelfSigned: true })).success).toBe(true);
    expect((await call(IPC.SERVER_UPDATE, 's1', { allowSelfSigned: 'yes' })).success).toBe(false);
  });
});

describe('SERVER_TEST', () => {
  const request = vi.fn().mockResolvedValue({});
  beforeEach(() => manager.createTemporaryClient.mockReturnValue({ request }));

  it('builds the temporary client with the submitted allowSelfSigned flag', async () => {
    expect((await call(IPC.SERVER_TEST, { ...server, useSSL: true, allowSelfSigned: true })).success).toBe(true);
    expect(manager.createTemporaryClient).toHaveBeenCalledWith(expect.objectContaining({ allowSelfSigned: true }));
  });

  it('leaves allowSelfSigned unset (strict TLS) when the flag is not submitted', async () => {
    await call(IPC.SERVER_TEST, { ...server, useSSL: true });
    expect(manager.createTemporaryClient.mock.calls[0]?.[0].allowSelfSigned).toBeUndefined();
  });
});

const secretServer = {
  id: 's1',
  ...server,
  username: 'u',
  password: 'pw',
  proxyType: 'http' as const,
  proxyHost: 'p',
  proxyPort: 3128,
  proxyPassword: 'ppw',
};

describe('passwords never reach the renderer', () => {
  it('SERVER_LIST returns servers without passwords, with has-flags', async () => {
    store.getServers.mockReturnValue([{ ...secretServer, hasPassword: true, hasProxyPassword: true }]);
    const res = await call(IPC.SERVER_LIST);
    expect(JSON.stringify(res)).not.toContain('"pw"');
    expect(JSON.stringify(res)).not.toContain('ppw');
    expect(res.data).toEqual([
      expect.objectContaining({ id: 's1', username: 'u', hasPassword: true, hasProxyPassword: true }),
    ]);
  });

  it('SERVER_ADD stores the password but does not return it', async () => {
    const res = await call(IPC.SERVER_ADD, { ...server, password: 'pw' });
    expect(store.addServer).toHaveBeenCalledWith(expect.objectContaining({ password: 'pw' }));
    expect(JSON.stringify(res)).not.toContain('pw');
    expect(res.data).toMatchObject({ hasPassword: true });
  });

  it('accepts a listed server echoed back with its has-flags, without storing them', async () => {
    store.getServers.mockReturnValue([secretServer]);
    expect(
      (await call(IPC.SERVER_UPDATE, 's1', { name: 'x', hasPassword: true, hasProxyPassword: false })).success,
    ).toBe(true);
    expect(store.updateServer).toHaveBeenCalledWith('s1', { name: 'x' });
    expect((await call(IPC.SERVER_ADD, { ...server, hasPassword: true })).success).toBe(true);
    expect(store.addServer.mock.calls[0]?.[0]).not.toHaveProperty('hasPassword');
  });
});

describe('SERVER_TEST credentials and errors', () => {
  const request = vi.fn();
  beforeEach(() => {
    request.mockReset().mockResolvedValue({});
    manager.createTemporaryClient.mockReturnValue({ request });
    store.getServers.mockReturnValue([secretServer]);
  });

  it('uses the stored password when editing a server whose endpoint is unchanged', async () => {
    await call(IPC.SERVER_TEST, {
      ...server,
      id: 's1',
      username: 'u',
      proxyType: 'http',
      proxyHost: 'p',
      proxyPort: 3128,
    });
    expect(manager.createTemporaryClient).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'pw', proxyPassword: 'ppw' }),
    );
  });

  it('does not send the stored password to a different host', async () => {
    await call(IPC.SERVER_TEST, { ...server, id: 's1', host: 'evil.example' });
    expect(manager.createTemporaryClient.mock.calls[0]?.[0].password).toBeUndefined();
  });

  it('returns the code and credential-free message of an RpcError', async () => {
    request.mockRejectedValue(new RpcError('AUTH', 'HTTP 401: Unauthorized'));
    expect(await call(IPC.SERVER_TEST, server)).toEqual({
      success: false,
      error: 'HTTP 401: Unauthorized',
      code: 'AUTH',
    });
  });

  it('never returns the text of an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    request.mockRejectedValue(new Error('failed for user:s3cret@proxy'));
    const res = await call(IPC.SERVER_TEST, { ...server, password: 's3cret' });
    expect(res).toEqual({ success: false, error: 'Request failed', code: 'UNKNOWN' });
    expect(JSON.stringify(res)).not.toContain('s3cret');
  });
});

describe('CONFIG_EXPORT', () => {
  beforeEach(() => {
    store.getServers.mockReturnValue([{ ...secretServer, hasPassword: true, hasProxyPassword: true }]);
    dialogMock.showMessageBox.mockReset();
  });

  it('omits passwords and flags by default and does not ask', async () => {
    const res = await call(IPC.CONFIG_EXPORT, { servers: true });
    const [exported] = (res.data as { servers: Array<Record<string, unknown>> }).servers;
    expect(exported).toMatchObject({ username: 'u' });
    expect(exported).not.toHaveProperty('password');
    expect(exported).not.toHaveProperty('proxyPassword');
    expect(exported).not.toHaveProperty('hasPassword');
    expect(dialogMock.showMessageBox).not.toHaveBeenCalled();
  });

  it('writes passwords to a main-chosen file after confirmation and returns no data', async () => {
    const target = path.join(dir, 'backup.json');
    dialogMock.showMessageBox.mockResolvedValue({ response: 1 });
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: target });
    const res = await call(IPC.CONFIG_EXPORT, { servers: true, includePasswords: true });
    expect(res).toEqual({ success: true });
    expect(
      (JSON.parse(fs.readFileSync(target, 'utf-8')) as { servers: Array<Record<string, unknown>> }).servers[0],
    ).toMatchObject({ password: 'pw', proxyPassword: 'ppw' });
    if (process.platform !== 'win32') expect(fs.statSync(target).mode & 0o777).toBe(0o600);
  });

  it('returns CANCELLED and writes nothing when the save dialog is dismissed', async () => {
    dialogMock.showMessageBox.mockResolvedValue({ response: 1 });
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true });
    const res = await call(IPC.CONFIG_EXPORT, { servers: true, includePasswords: true });
    expect(res).toMatchObject({ success: false, code: 'CANCELLED' });
    expect(res).not.toHaveProperty('data');
  });

  it('refuses when the user declines, exporting nothing', async () => {
    dialogMock.showMessageBox.mockResolvedValue({ response: 0 });
    const res = await call(IPC.CONFIG_EXPORT, { servers: true, includePasswords: true });
    expect(res).toMatchObject({ success: false, code: 'CANCELLED' });
    expect(JSON.stringify(res)).not.toContain('pw');
  });
});

describe('secret storage status', () => {
  it('reports whether passwords are encrypted', async () => {
    store.isSecretStorageEncrypted.mockReturnValue(false);
    expect(await call(IPC.CONFIG_SECRET_STORAGE)).toEqual({ success: true, data: false });
  });
});

describe('SERVER_SET_ACTIVE', () => {
  it('rejects an unknown id without touching the store or the connection manager', async () => {
    store.getServers.mockReturnValue([{ ...server, id: 'known' }]);
    const res = await call(IPC.SERVER_SET_ACTIVE, 'ghost');
    expect(res).toMatchObject({ success: false, error: 'Invalid request' });
    expect(store.setActiveServerId).not.toHaveBeenCalled();
    expect(manager.setActiveServer).not.toHaveBeenCalled();
    expect(manager.clearActive).not.toHaveBeenCalled();
  });

  it('activates a known server in the store and the connection manager', async () => {
    const known = { ...server, id: 'known' };
    store.getServers.mockReturnValue([known]);
    expect(await call(IPC.SERVER_SET_ACTIVE, 'known')).toMatchObject({ success: true });
    expect(store.setActiveServerId).toHaveBeenCalledWith('known');
    expect(manager.setActiveServer).toHaveBeenCalledWith(known);
  });

  it('clears the active client when null is sent', async () => {
    expect(await call(IPC.SERVER_SET_ACTIVE, null)).toMatchObject({ success: true });
    expect(store.setActiveServerId).toHaveBeenCalledWith(null);
    expect(manager.clearActive).toHaveBeenCalled();
  });
});
