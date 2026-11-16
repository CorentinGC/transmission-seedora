import type { PlatformApi } from '@shared/platform/api-types';
import type { ServerConfig, ServerConfigPatch, NewServerConfig, IpcResponse, AppPreferences } from '@shared/types';
import { rpcRequest as rpcAction, testServerConnection } from './server-actions/rpc';
import { setActiveServerCookie, clearServerCookie } from './server-actions/session';
import { geoipLookup as serverGeoipLookup } from './server-actions/geoip';
import { failure } from './server/errors';
import { importDataSchema } from './config-import-schema';
import { withSessionRecovery } from './session-recovery';
import { GEOIP_CHUNK_SIZE, chunk, toServerTarget } from './server-target';
import {
  getServers,
  setServers,
  getActiveServerId,
  setActiveServerId,
  getPreferences,
  setPreferences,
} from './web-storage';

type RpcArgs = Record<string, unknown> | undefined;

/**
 * One RPC call through the server action. The arguments travel as a JSON string, so a decoded
 * object graph never reaches the server (ADR 0004 section 2); `undefined` is dropped and `NaN`
 * becomes null, as on the wire before. Recovers once from a lost
 * session cookie.
 */
function rpcRequest(method: string, args?: RpcArgs): Promise<IpcResponse> {
  let text: string | undefined;
  try {
    text = args === undefined ? undefined : JSON.stringify(args);
  } catch {
    return Promise.resolve(failure('INVALID_INPUT'));
  }
  return withSessionRecovery(() => rpcAction(method, text));
}

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Seals the cookie for `server`. On failure the previous sealed cookie (valid for hours) would keep
 * pointing at the old target while the UI shows the new one, so it is cleared: the next call gets
 * NO_SESSION and recovery re-seals from storage. The seal failure is what is reported.
 */
async function resealOrClear(server: ServerConfig): Promise<IpcResponse> {
  let sealed: IpcResponse;
  try {
    sealed = await setActiveServerCookie(toServerTarget(server));
  } catch {
    sealed = failure('INVALID_INPUT');
  }
  if (sealed.success) return sealed;
  await clearServerCookie();
  return sealed;
}

/** A copy of `server` without its password and proxy password. */
function withoutPasswords(server: ServerConfig): ServerConfig {
  const { password: _password, proxyPassword: _proxyPassword, ...rest } = server;
  return rest;
}

/** Fields that are derived or one-shot and must never be persisted. */
function withoutTransientFields(server: ServerConfig): ServerConfig {
  const { hasPassword: _a, hasProxyPassword: _b, clearPassword: _c, clearProxyPassword: _d, ...rest } = server;
  return rest;
}

/** The server as the UI sees it: stored fields plus `hasPassword` / `hasProxyPassword` derived from them. */
function withPasswordFlags(server: ServerConfig): ServerConfig {
  return { ...server, hasPassword: !!server.password, hasProxyPassword: !!server.proxyPassword };
}

/**
 * Applies `updates` to `previous` like Electron's `updateServer`: `undefined` fields change nothing,
 * an empty or missing password means "unchanged", and a secret is erased only by an exact
 * `clearPassword` / `clearProxyPassword` `true`, which wins over a password in the same patch.
 * `id` is never overwritten and the clear flags are never stored.
 */
function mergeServerUpdate(previous: ServerConfig, updates: ServerConfigPatch): ServerConfig {
  const { clearPassword, clearProxyPassword, id: _id, hasPassword: _a, hasProxyPassword: _b, ...fields } = updates;
  const defined = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  const merged: ServerConfig = { ...previous, ...defined };
  if (defined.password === '') merged.password = previous.password;
  if (defined.proxyPassword === '') merged.proxyPassword = previous.proxyPassword;
  if (clearPassword === true) delete merged.password;
  if (clearProxyPassword === true) delete merged.proxyPassword;
  return merged;
}

export const webApi: PlatformApi = {
  // ── Server management (localStorage) ──

  async serverList(): Promise<IpcResponse<ServerConfig[]>> {
    return { success: true, data: getServers().map(withPasswordFlags) };
  },

  async serverAdd(config: NewServerConfig): Promise<IpcResponse<ServerConfig>> {
    const servers = getServers();
    const newServer = withoutTransientFields({ ...config, id: generateId() });
    servers.push(newServer);
    setServers(servers);
    return { success: true, data: withPasswordFlags(newServer) };
  },

  async serverUpdate(id: string, updates: ServerConfigPatch): Promise<IpcResponse> {
    const servers = getServers();
    const idx = servers.findIndex((s) => s.id === id);
    if (idx === -1) return failure('SERVER_NOT_FOUND');
    const previous = servers[idx];
    servers[idx] = mergeServerUpdate(previous, updates);
    setServers(servers);
    // The sealed cookie holds a copy of the active target: re-seal it so the edit applies now.
    const updated: IpcResponse<ServerConfig> = { success: true, data: withPasswordFlags(servers[idx]) };
    if (getActiveServerId() !== id) return updated;
    const sealed = await resealOrClear(servers[idx]);
    if (!sealed.success) {
      // Rejected edit: put the previous entry back so storage matches what the cookie will be re-sealed from.
      setServers(getServers().map((s) => (s.id === id ? previous : s)));
      return sealed;
    }
    return updated;
  },

  async serverRemove(id: string): Promise<IpcResponse> {
    const servers = getServers().filter((s) => s.id !== id);
    setServers(servers);
    if (getActiveServerId() === id) {
      setActiveServerId(null);
      const cleared = await clearServerCookie();
      if (!cleared.success) return cleared;
    }
    return { success: true };
  },

  async serverSetActive(id: string | null): Promise<IpcResponse> {
    if (!id) {
      setActiveServerId(null);
      return clearServerCookie();
    }
    const server = getServers().find((s) => s.id === id);
    if (!server) return failure('SERVER_NOT_FOUND');
    // The new id is stored before the cookie is written: a session recovery running meanwhile
    // reads the id from storage and must seal this server, not the previous one.
    const previousId = getActiveServerId();
    setActiveServerId(id);
    const result = await setActiveServerCookie(toServerTarget(server));
    if (!result.success) {
      // Roll back only our own write: a later switch to another server must not be undone.
      if (getActiveServerId() === id) setActiveServerId(previousId);
      return result;
    }
    return { success: true };
  },

  async serverTest(config: ServerConfig | NewServerConfig): Promise<IpcResponse> {
    return testServerConnection(toServerTarget(config));
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

  /**
   * Passwords (server and proxy) are left out unless the caller passes `includePasswords: true`
   * (c07.8): a backup file is easy to share by accident. The option is not in the shared
   * `PlatformApi` type yet; the UI cannot opt in until it is.
   */
  async configExport(options: {
    servers?: boolean;
    preferences?: boolean;
    serverIds?: string[];
    includePasswords?: boolean;
  }): Promise<IpcResponse> {
    const data: Record<string, unknown> = {};
    if (options.servers) {
      const servers = getServers();
      const selected = options.serverIds ? servers.filter((s) => options.serverIds!.includes(s.id)) : servers;
      data.servers = options.includePasswords === true ? selected : selected.map(withoutPasswords);
    }
    if (options.preferences) {
      data.preferences = getPreferences();
    }
    return { success: true, data };
  },

  /**
   * Same contract as Electron: the whole parsed backup is validated first (nothing is applied on
   * failure), servers are only added (duplicates by host+port+path skipped, fresh ids,
   * `allowSelfSigned` stripped) and preferences are a partial patch without `watchFolder`.
   * Existing servers, the active server and the sealed cookie are never touched.
   */
  async configImport(data: Record<string, unknown>): Promise<IpcResponse> {
    const parsed = importDataSchema.safeParse(data);
    if (!parsed.success) return failure('IMPORT_INVALID');
    const { servers: imported, preferences } = parsed.data;

    let serversAdded = 0;
    let serversSkipped = 0;
    if (imported) {
      const servers = getServers();
      for (const entry of imported) {
        const duplicate = servers.some((s) => s.host === entry.host && s.port === entry.port && s.path === entry.path);
        if (duplicate) {
          serversSkipped++;
        } else {
          servers.push({ ...entry, id: generateId() });
          serversAdded++;
        }
      }
      if (serversAdded > 0) setServers(servers);
    }

    if (preferences) {
      const { watchFolder: _ignored, ...safePrefs } = preferences;
      setPreferences(safePrefs);
    }
    return { success: true, data: { serversAdded, serversSkipped, prefsImported: preferences !== undefined } };
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
    const data: Record<string, { country: string; region: string; city: string } | null> = {};
    for (const batch of chunk([...new Set(ips)], GEOIP_CHUNK_SIZE)) {
      const result = await serverGeoipLookup(batch);
      if (!result.success) return result;
      Object.assign(data, result.data);
    }
    return { success: true, data };
  },
};
