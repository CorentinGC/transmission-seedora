import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, ...args: unknown[]) => Promise<{ success: boolean; error?: string; code?: string; data?: unknown }>;
const handlers = new Map<string, Handler>();

const confirm = vi.hoisted(() => ({ confirmScriptChanges: vi.fn() }));
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn), on: vi.fn() },
  BrowserWindow: { fromWebContents: () => null },
}));
vi.mock('./script-confirm-dialog', () => confirm);
const request = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({ getServers: vi.fn(), getActiveServerId: vi.fn() }));
vi.mock('../store/config-store', () => ({ configStore: store }));
const manager = vi.hoisted(() => ({ getActiveClient: vi.fn() }));
vi.mock('../rpc/connection-manager', () => ({ connectionManager: manager }));

const { IPC } = await import('@ipc/ipc-channels');
const { registerRpcHandlers } = await import('./rpc-handlers');

const sessionSet = (params: Record<string, unknown>) => {
  const handler = handlers.get(IPC.RPC_SESSION_SET);
  if (!handler) throw new Error('no handler');
  return handler({ sender: {}, senderFrame: {} }, params);
};

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  manager.getActiveClient.mockReturnValue({ request });
  store.getActiveServerId.mockReturnValue('a');
  store.getServers.mockReturnValue([{ id: 'a', name: 'Home', host: 'nas', port: 9091 }]);
  registerRpcHandlers(() => true);
});

describe('RPC_SESSION_SET guard wiring', () => {
  it('returns CANCELLED and never sends session-set when the user declines a script change', async () => {
    request.mockResolvedValueOnce({ 'script-torrent-done-filename': '' });
    confirm.confirmScriptChanges.mockResolvedValueOnce(false);
    const res = await sessionSet({ 'script-torrent-done-filename': '/evil.sh' });
    expect(res).toMatchObject({ success: false, code: 'CANCELLED' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalledWith('session-set', expect.anything());
  });

  it('sends session-set after approval', async () => {
    request.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    confirm.confirmScriptChanges.mockResolvedValueOnce(true);
    const res = await sessionSet({ 'script-torrent-done-filename': '/ok.sh' });
    expect(res.success).toBe(true);
    expect(request).toHaveBeenLastCalledWith('session-set', { 'script-torrent-done-filename': '/ok.sh' });
  });

  it('passes harmless settings straight through without a prompt', async () => {
    request.mockResolvedValueOnce({});
    const res = await sessionSet({ 'speed-limit-down': 10 });
    expect(res.success).toBe(true);
    expect(confirm.confirmScriptChanges).not.toHaveBeenCalled();
  });

  it('returns NO_CONNECTION before running the guard when no server is active', async () => {
    manager.getActiveClient.mockReturnValue(undefined);
    const res = await sessionSet({ 'script-torrent-done-filename': '/x.sh' });
    expect(res).toMatchObject({ success: false, code: 'NO_CONNECTION' });
    expect(confirm.confirmScriptChanges).not.toHaveBeenCalled();
  });

  it('writes to the client that was checked even if the active server switches meanwhile', async () => {
    const other = vi.fn().mockResolvedValue({});
    request.mockImplementationOnce(async () => {
      manager.getActiveClient.mockReturnValue({ request: other }); // user switches server during the fetch
      return {};
    });
    request.mockResolvedValueOnce({});
    confirm.confirmScriptChanges.mockResolvedValueOnce(true);
    await sessionSet({ 'script-torrent-done-filename': '/ok.sh' });
    expect(other).not.toHaveBeenCalled();
    expect(request).toHaveBeenLastCalledWith('session-set', { 'script-torrent-done-filename': '/ok.sh' });
  });

  it('names the target server in the confirmation', async () => {
    request.mockResolvedValueOnce({});
    confirm.confirmScriptChanges.mockResolvedValueOnce(false);
    await sessionSet({ 'script-torrent-done-filename': '/x.sh' });
    expect(confirm.confirmScriptChanges).toHaveBeenCalledWith(null, expect.any(Array), 'Home (nas:9091)');
  });
});
