import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { IpcResponse } from '@shared/types';
import { connectionManager } from '../rpc/connection-manager';

function getClient() {
  const client = connectionManager.getActiveClient();
  if (!client) throw new Error('No active server connection');
  return client;
}

async function rpcHandler<T>(method: string, args?: Record<string, unknown>): Promise<IpcResponse<T>> {
  try {
    const result = await getClient().request(method, args);
    return { success: true, data: result as T };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function registerRpcHandlers(): void {
  // Torrent actions
  ipcMain.handle(IPC.RPC_TORRENT_GET, (_, fields: string[], ids?: number[] | 'recently-active') =>
    rpcHandler('torrent-get', { fields, ...(ids !== undefined && { ids }) }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_SET, (_, ids: number[], params: Record<string, unknown>) =>
    rpcHandler('torrent-set', { ids, ...params }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_ADD, (_, params: Record<string, unknown>) =>
    rpcHandler('torrent-add', params),
  );

  ipcMain.handle(IPC.RPC_TORRENT_REMOVE, (_, ids: number[], deleteLocalData: boolean) =>
    rpcHandler('torrent-remove', { ids, 'delete-local-data': deleteLocalData }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_START, (_, ids: number[]) =>
    rpcHandler('torrent-start', { ids }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_START_NOW, (_, ids: number[]) =>
    rpcHandler('torrent-start-now', { ids }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_STOP, (_, ids: number[]) =>
    rpcHandler('torrent-stop', { ids }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_VERIFY, (_, ids: number[]) =>
    rpcHandler('torrent-verify', { ids }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_REANNOUNCE, (_, ids: number[]) =>
    rpcHandler('torrent-reannounce', { ids }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_SET_LOCATION, (_, ids: number[], location: string, move: boolean) =>
    rpcHandler('torrent-set-location', { ids, location, move }),
  );

  ipcMain.handle(IPC.RPC_TORRENT_RENAME_PATH, (_, ids: number[], path: string, name: string) =>
    rpcHandler('torrent-rename-path', { ids, path, name }),
  );

  // Queue
  ipcMain.handle(IPC.RPC_QUEUE_MOVE_TOP, (_, ids: number[]) =>
    rpcHandler('queue-move-top', { ids }),
  );

  ipcMain.handle(IPC.RPC_QUEUE_MOVE_UP, (_, ids: number[]) =>
    rpcHandler('queue-move-up', { ids }),
  );

  ipcMain.handle(IPC.RPC_QUEUE_MOVE_DOWN, (_, ids: number[]) =>
    rpcHandler('queue-move-down', { ids }),
  );

  ipcMain.handle(IPC.RPC_QUEUE_MOVE_BOTTOM, (_, ids: number[]) =>
    rpcHandler('queue-move-bottom', { ids }),
  );

  // Session
  ipcMain.handle(IPC.RPC_SESSION_GET, (_, fields?: string[]) =>
    rpcHandler('session-get', fields ? { fields } : undefined),
  );

  ipcMain.handle(IPC.RPC_SESSION_SET, (_, params: Record<string, unknown>) =>
    rpcHandler('session-set', params),
  );

  ipcMain.handle(IPC.RPC_SESSION_STATS, () =>
    rpcHandler('session-stats'),
  );

  ipcMain.handle(IPC.RPC_SESSION_CLOSE, () =>
    rpcHandler('session-close'),
  );

  // Utilities
  ipcMain.handle(IPC.RPC_FREE_SPACE, (_, path: string) =>
    rpcHandler('free-space', { path }),
  );

  ipcMain.handle(IPC.RPC_PORT_TEST, () =>
    rpcHandler('port-test'),
  );

  ipcMain.handle(IPC.RPC_BLOCKLIST_UPDATE, () =>
    rpcHandler('blocklist-update'),
  );

  ipcMain.handle(IPC.RPC_GROUP_GET, (_, group?: string | string[]) =>
    rpcHandler('group-get', group ? { group } : undefined),
  );

  ipcMain.handle(IPC.RPC_GROUP_SET, (_, params: Record<string, unknown>) =>
    rpcHandler('group-set', params),
  );
}
