import type { ServerConfig } from '@shared/types';
import { TransmissionRpcClient } from './client';

/** Holds one RPC client per server and tracks the active one. */
export class ConnectionManager {
  private clients = new Map<string, TransmissionRpcClient>();
  private activeServerId: string | null = null;

  setActiveServer(server: ServerConfig): void {
    this.activeServerId = server.id;
    if (!this.clients.has(server.id)) {
      this.clients.set(server.id, new TransmissionRpcClient(server));
    }
  }

  getActiveClient(): TransmissionRpcClient | null {
    if (!this.activeServerId) return null;
    return this.clients.get(this.activeServerId) ?? null;
  }

  removeClient(serverId: string): void {
    this.clients.delete(serverId);
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
    this.clients.set(server.id, new TransmissionRpcClient(server));
  }
}

export const connectionManager = new ConnectionManager();
