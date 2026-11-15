import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, ...args: unknown[]) => Promise<{ success: boolean; error?: string; data?: unknown }>;
const handlers = new Map<string, Handler>();

vi.mock('electron', () => ({ ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn), on: vi.fn() } }));

const store = vi.hoisted(() => ({
  getServers: vi.fn(),
  addServer: vi.fn(),
  updateServer: vi.fn(),
  removeServer: vi.fn(),
  setActiveServerId: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));
vi.mock('../store/config-store', () => ({ configStore: store }));
const manager = vi.hoisted(() => ({ refreshClient: vi.fn(), removeClient: vi.fn(), setActiveServer: vi.fn(), createTemporaryClient: vi.fn() }));
vi.mock('../rpc/connection-manager', () => ({ connectionManager: manager }));

const { IPC } = await import('@shared/ipc-channels');
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
  it('never imports watchFolder and skips duplicate servers', () => {
    store.getServers.mockReturnValue([{ ...server, id: 'x' }]);
    const res = applyImport({
      servers: [server, { ...server, host: 'other' }],
      preferences: { theme: 'dark', watchFolder: '/etc' },
    });
    expect(res.data).toEqual({ serversAdded: 1, serversSkipped: 1, prefsImported: true });
    expect(store.updatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
    expect(store.addServer).toHaveBeenCalledTimes(1);
  });
});

describe('CONFIG_IMPORT', () => {
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
