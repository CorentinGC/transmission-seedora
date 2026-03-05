import type { PlatformApi } from '@shared/platform/api-types';
import type { ServerConfig, NewServerConfig, IpcResponse, AppPreferences } from '@shared/types';
import { rpcRequest, testServerConnection } from './server-actions/rpc';
import { setActiveServerCookie, clearServerCookie } from './server-actions/session';
import { geoipLookup as serverGeoipLookup } from './server-actions/geoip';
import {
  getServers,
  setServers,
  getActiveServerId,
  setActiveServerId,
  getPreferences,
  setPreferences,
} from './web-storage';

function generateId(): string {
  return crypto.randomUUID();
}

export const webApi: PlatformApi = {
  // ── Server management (localStorage) ──

  async serverList(): Promise<IpcResponse<ServerConfig[]>> {
    return { success: true, data: getServers() };
  },

  async serverAdd(config: NewServerConfig): Promise<IpcResponse<ServerConfig>> {
    const servers = getServers();
    const newServer: ServerConfig = { ...config, id: generateId() };
    servers.push(newServer);
    setServers(servers);
    return { success: true, data: newServer };
  },

  async serverUpdate(id: string, updates: Partial<ServerConfig>): Promise<IpcResponse> {
    const servers = getServers();
    const idx = servers.findIndex((s) => s.id === id);
    if (idx === -1) return { success: false, error: 'Server not found' };
    servers[idx] = { ...servers[idx], ...updates };
    setServers(servers);
    return { success: true };
  },

  async serverRemove(id: string): Promise<IpcResponse> {
    const servers = getServers().filter((s) => s.id !== id);
    setServers(servers);
    if (getActiveServerId() === id) {
      setActiveServerId(null);
      await clearServerCookie();
    }
    return { success: true };
  },

  async serverSetActive(id: string | null): Promise<IpcResponse> {
    setActiveServerId(id);
    if (id) {
      const server = getServers().find((s) => s.id === id);
      if (server) {
        await setActiveServerCookie(server);
      }
    } else {
      await clearServerCookie();
    }
    return { success: true };
  },

  async serverTest(config: ServerConfig | NewServerConfig): Promise<IpcResponse> {
    const result = await testServerConnection({
      host: config.host,
      port: config.port,
      path: config.path,
      useSSL: config.useSSL,
      username: config.username,
      password: config.password,
    });
    return result;
  },

  // ── RPC torrent (via Server Actions) ──

  async rpcTorrentGet(fields: string[], ids?: number[] | 'recently-active'): Promise<IpcResponse> {
    const args: Record<string, unknown> = { fields };
    if (ids) args.ids = ids;
    return rpcRequest('torrent-get', args);
  },

  async rpcTorrentSet(ids: number[], params: Record<string, unknown>): Promise<IpcResponse> {
    return rpcRequest('torrent-set', { ids, ...params });
  },

  async rpcTorrentAdd(params: Record<string, unknown>): Promise<IpcResponse> {
    return rpcRequest('torrent-add', params);
  },

  async rpcTorrentRemove(ids: number[], deleteLocalData: boolean): Promise<IpcResponse> {
    return rpcRequest('torrent-remove', { ids, 'delete-local-data': deleteLocalData });
  },

  async rpcTorrentStart(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('torrent-start', { ids });
  },

  async rpcTorrentStartNow(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('torrent-start-now', { ids });
  },

  async rpcTorrentStop(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('torrent-stop', { ids });
  },

  async rpcTorrentVerify(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('torrent-verify', { ids });
  },

  async rpcTorrentReannounce(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('torrent-reannounce', { ids });
  },

  async rpcTorrentSetLocation(ids: number[], location: string, move: boolean): Promise<IpcResponse> {
    return rpcRequest('torrent-set-location', { ids, location, move });
  },

  async rpcTorrentRenamePath(ids: number[], path: string, name: string): Promise<IpcResponse> {
    return rpcRequest('torrent-rename-path', { ids, path, name });
  },

  // ── RPC queue ──

  async rpcQueueMoveTop(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('queue-move-top', { ids });
  },

  async rpcQueueMoveUp(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('queue-move-up', { ids });
  },

  async rpcQueueMoveDown(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('queue-move-down', { ids });
  },

  async rpcQueueMoveBottom(ids: number[]): Promise<IpcResponse> {
    return rpcRequest('queue-move-bottom', { ids });
  },

  // ── RPC session ──

  async rpcSessionGet(fields?: string[]): Promise<IpcResponse> {
    const args = fields ? { fields } : undefined;
    return rpcRequest('session-get', args);
  },

  async rpcSessionSet(params: Record<string, unknown>): Promise<IpcResponse> {
    return rpcRequest('session-set', params);
  },

  async rpcSessionStats(): Promise<IpcResponse> {
    return rpcRequest('session-stats');
  },

  async rpcSessionClose(): Promise<IpcResponse> {
    return rpcRequest('session-close');
  },

  // ── RPC utilities ──

  async rpcFreeSpace(path: string): Promise<IpcResponse> {
    return rpcRequest('free-space', { path });
  },

  async rpcPortTest(): Promise<IpcResponse> {
    return rpcRequest('port-test');
  },

  async rpcBlocklistUpdate(): Promise<IpcResponse> {
    return rpcRequest('blocklist-update');
  },

  async rpcGroupGet(group?: string | string[]): Promise<IpcResponse> {
    const args = group ? { group } : undefined;
    return rpcRequest('group-get', args);
  },

  async rpcGroupSet(params: Record<string, unknown>): Promise<IpcResponse> {
    return rpcRequest('group-set', params);
  },

  // ── Config export/import (localStorage) ──

  async configExport(options: { servers?: boolean; preferences?: boolean; serverIds?: string[] }): Promise<IpcResponse> {
    const data: Record<string, unknown> = {};
    if (options.servers) {
      const servers = getServers();
      data.servers = options.serverIds
        ? servers.filter((s) => options.serverIds!.includes(s.id))
        : servers;
    }
    if (options.preferences) {
      data.preferences = getPreferences();
    }
    return { success: true, data };
  },

  async configImport(data: Record<string, unknown>): Promise<IpcResponse> {
    if (data.servers && Array.isArray(data.servers)) {
      setServers(data.servers as ServerConfig[]);
    }
    if (data.preferences && typeof data.preferences === 'object') {
      setPreferences(data.preferences as Partial<AppPreferences>);
    }
    return { success: true };
  },

  // ── Preferences (localStorage) ──

  async prefsGet(): Promise<IpcResponse<AppPreferences>> {
    return { success: true, data: getPreferences() };
  },

  async prefsSet(prefs: Partial<AppPreferences>): Promise<IpcResponse> {
    setPreferences(prefs);
    return { success: true };
  },

  // ── Platform-specific: Web implementations ──

  // Web Notifications API (optional — user must grant permission)
  notificationShow(title: string, body: string): void {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icons/icon-192.png' });
    } else if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(title, { body, icon: '/icons/icon-192.png' });
        }
      });
    }
  },

  // GeoIP via server action
  async geoipLookup(ips: string[]) {
    return serverGeoipLookup(ips);
  },
};
