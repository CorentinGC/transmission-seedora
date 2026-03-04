import type { ServerConfig } from '@shared/types';
import { TransmissionRpcClient } from './client';

class ConnectionManager {
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

  refreshClient(server: ServerConfig): void {
    this.clients.set(server.id, new TransmissionRpcClient(server));
  }
}

export const connectionManager = new ConnectionManager();
