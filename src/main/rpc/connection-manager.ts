import type { ServerConfig } from '@shared/types';
import { TransmissionRpcClient } from './client';

/** Holds one RPC client per server and tracks the active one. */
export class ConnectionManager {
  private clients = new Map<string, TransmissionRpcClient>();
  private servers = new Map<string, ServerConfig>();
  private activeServerId: string | null = null;

  setActiveServer(server: ServerConfig): void {
    this.activeServerId = server.id;
    this.servers.set(server.id, server);
    if (!this.clients.has(server.id)) {
      this.clients.set(server.id, new TransmissionRpcClient(server));
    }
  }

  getActiveClient(): TransmissionRpcClient | null {
    if (!this.activeServerId) return null;
    return this.clients.get(this.activeServerId) ?? null;
  }

  /** The active client together with the server config it was built for (the source of any label shown for a write). */
  getActive(): { client: TransmissionRpcClient; server: ServerConfig } | null {
    if (!this.activeServerId) return null;
    const client = this.clients.get(this.activeServerId);
    const server = this.servers.get(this.activeServerId);
    return client && server ? { client, server } : null;
  }

  /** Leaves no server active: later requests fail with NO_CONNECTION. */
  clearActive(): void {
    this.activeServerId = null;
  }

  removeClient(serverId: string): void {
    this.clients.delete(serverId);
    this.servers.delete(serverId);
    if (this.activeServerId === serverId) {
      this.activeServerId = null;
    }
  }

  createTemporaryClient(config: ServerConfig): TransmissionRpcClient {
    return new TransmissionRpcClient(config);
  }

  /** Rebuilds the cached client of an edited server so new host/credentials/TLS options apply to the next request. */
  refreshClient(server: ServerConfig): void {
    if (!this.clients.has(server.id)) return;
    this.servers.set(server.id, server);
    this.clients.set(server.id, new TransmissionRpcClient(server));
  }
}

export const connectionManager = new ConnectionManager();
