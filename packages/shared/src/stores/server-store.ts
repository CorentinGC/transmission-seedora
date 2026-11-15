import { create } from 'zustand';
import type { ServerConfig, NewServerConfig } from '../types/server';
import type { ServerConfigPatch } from '../types';
import type { IpcResponse } from '../types';
import { describeFailure, errorCodeKey } from '../lib/error-messages';
import { getPlatformApi } from '../platform/api-store';
import { useTorrentStore } from './torrent-store';
import { useSessionStore } from './session-store';
import { guardedCall } from '../lib/guarded-call';
import { bumpServerEpoch, isServerEpochCurrent } from '../lib/server-epoch';

/** Outcome of saving a server; `reason` is a translated message when the failure code is known, else null. */
export type SaveResult<T> = { ok: true; data: T } | { ok: false; reason: string | null };

interface ServerStore {
  servers: ServerConfig[];
  activeServerId: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectionError: string | null;

  /** Loads the saved servers; a failure is notified and the current list is kept. */
  fetchServers: () => Promise<void>;
  /** Resolves the new server, or the failure (the caller shows it inline). Reloads the list on success. */
  addServer: (config: NewServerConfig) => Promise<SaveResult<ServerConfig>>;
  /** Resolves ok, or the failure (the caller shows it inline). Reloads the list on success. */
  updateServer: (id: string, updates: ServerConfigPatch) => Promise<SaveResult<undefined>>;
  /** Resolves false on failure, after notifying the user. */
  removeServer: (id: string) => Promise<boolean>;
  setActiveServer: (id: string | null) => Promise<void>;
  testConnection: (config: ServerConfig | NewServerConfig) => Promise<boolean>;
  setConnectionStatus: (status: ServerStore['connectionStatus'], error?: string) => void;
}

/** Awaits a platform call, resolving null instead of rejecting when it throws. */
async function settle<T>(call: () => Promise<IpcResponse<T>>): Promise<IpcResponse<T> | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}

/** Failed save result carrying the translated reason, when the platform gave a known code. */
function saveFailure(res: IpcResponse | null): { ok: false; reason: string | null } {
  return { ok: false, reason: res && errorCodeKey(res.code) ? describeFailure(res.error, res.code) : null };
}

/** Tooltip text for a failed connection: the translated message for a known code, else the platform's text, else a generic one. */
function connectionErrorText(res: IpcResponse): string {
  return describeFailure(res.error, res.code);
}

export const useServerStore = create<ServerStore>((set, get) => ({
  servers: [],
  activeServerId: null,
  connectionStatus: 'disconnected',
  connectionError: null,

  fetchServers: async () => {
    const res = await guardedCall(() => getPlatformApi().serverList(), 'notification.serversLoadFailed');
    if (res?.data) set({ servers: res.data });
  },

  addServer: async (config) => {
    const res = await settle(() => getPlatformApi().serverAdd(config));
    if (!res?.success || !res.data) return saveFailure(res);
    await get().fetchServers();
    return { ok: true, data: res.data };
  },

  updateServer: async (id, updates) => {
    const res = await settle(() => getPlatformApi().serverUpdate(id, updates));
    if (!res?.success) return saveFailure(res);
    // Re-read instead of merging: the platform is the source of truth for the stored-password flags.
    await get().fetchServers();
    return { ok: true, data: undefined };
  },

  removeServer: async (id) => {
    const res = await guardedCall(() => getPlatformApi().serverRemove(id), 'notification.serverRemoveFailed');
    if (!res) return false;
    if (useServerStore.getState().activeServerId === id) bumpServerEpoch();
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
      activeServerId: state.activeServerId === id ? null : state.activeServerId,
      connectionStatus: state.activeServerId === id ? 'disconnected' : state.connectionStatus,
    }));
    return true;
  },

  setActiveServer: async (id) => {
    // A newer call (or a server removal) makes every response of this one stale.
    const epoch = bumpServerEpoch();
    set({ connectionStatus: id ? 'connecting' : 'disconnected', connectionError: null });
    if (!id) {
      useTorrentStore.getState().reset();
      useSessionStore.getState().reset();
    }
    try {
      const res = await getPlatformApi().serverSetActive(id);
      if (!isServerEpochCurrent(epoch)) return;
      if (!res.success) {
        set({ connectionStatus: 'error', connectionError: connectionErrorText(res) });
        return;
      }
      set({ activeServerId: id });
      if (!id) return;
      const sessionRes = await getPlatformApi().rpcSessionGet();
      if (!isServerEpochCurrent(epoch)) return;
      if (sessionRes.success) {
        set({ connectionStatus: 'connected' });
      } else {
        set({ connectionStatus: 'error', connectionError: connectionErrorText(sessionRes) });
      }
    } catch (err) {
      if (!isServerEpochCurrent(epoch)) return;
      set({ connectionStatus: 'error', connectionError: err instanceof Error ? err.message : null });
    }
  },

  testConnection: async (config) => {
    const res = await settle(() => getPlatformApi().serverTest(config));
    return res?.success === true;
  },

  setConnectionStatus: (status, error) => {
    set({ connectionStatus: status, connectionError: error ?? null });
  },
}));
