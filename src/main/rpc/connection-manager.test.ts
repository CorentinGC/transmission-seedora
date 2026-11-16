import { describe, expect, it, vi } from 'vitest';

const created: Array<{ host: string; allowSelfSigned?: boolean }> = [];
vi.mock('./client', () => ({
  TransmissionRpcClient: class {
    constructor(readonly config: { host: string; allowSelfSigned?: boolean }) {
      created.push(config);
    }
  },
}));

const { ConnectionManager } = await import('./connection-manager');

const server = { id: 's1', name: 'n', host: 'a', port: 9091, path: '/transmission/rpc', useSSL: false };

describe('ConnectionManager.refreshClient', () => {
  it('replaces the active client so the next request uses the edited config', () => {
    const manager = new ConnectionManager();
    manager.setActiveServer(server);
    const before = manager.getActiveClient();
    manager.refreshClient({ ...server, host: 'b' });
    const after = manager.getActiveClient();
    expect(after).not.toBe(before);
    expect((after as unknown as { config: { host: string } }).config.host).toBe('b');
  });

  it('applies an edited allowSelfSigned flag to the rebuilt client', () => {
    const manager = new ConnectionManager();
    manager.setActiveServer(server);
    manager.refreshClient({ ...server, useSSL: true, allowSelfSigned: true });
    const config = (manager.getActiveClient() as unknown as { config: { allowSelfSigned?: boolean } }).config;
    expect(config.allowSelfSigned).toBe(true);
  });

  it('does not build a client for a server that was never used', () => {
    const manager = new ConnectionManager();
    const count = created.length;
    manager.refreshClient(server);
    expect(created.length).toBe(count);
  });
});
