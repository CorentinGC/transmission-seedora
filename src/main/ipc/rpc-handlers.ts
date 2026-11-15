import { BrowserWindow } from 'electron';
import { z } from 'zod';
import { IPC } from '@ipc/ipc-channels';
import type { IpcResponse } from '@shared/types';
import { t } from '../i18n/main-i18n';
import { RpcError } from '../rpc/client';
import { configStore } from '../store/config-store';
import { connectionManager } from '../rpc/connection-manager';
import { toIpcError } from '../rpc/to-ipc-error';
import { handleGuarded, type SenderValidator } from '../security/ipc-guard';
import { ApprovedPathError } from '../security/approved-paths';
import { isSessionChangeAllowed } from '../security/script-guard';
import { resolveTorrentAddParams } from '../security/torrent-source';
import { confirmScriptChanges } from './script-confirm-dialog';
import { rpcParamsSchema, rpcParamsWithoutIdsSchema, torrentAddSchema, torrentIdsSchema } from '../security/schemas';

function getClient() {
  const client = connectionManager.getActiveClient();
  if (!client) throw new RpcError('NO_CONNECTION', 'No active server connection');
  return client;
}

async function rpcHandler<T>(method: string, args?: Record<string, unknown>): Promise<IpcResponse<T>> {
  try {
    const result = await getClient().request(method, args);
    return { success: true, data: result as T };
  } catch (err) {
    return toIpcError(err);
  }
}

const ids = torrentIdsSchema;
const fieldNames = z.array(z.string().min(1).max(64)).max(200);
const pathString = z.string().min(1).max(4096);

/** Registers the Transmission RPC channels. Every argument is validated before the daemon is contacted. */
export function registerRpcHandlers(isTrusted: SenderValidator): void {
  const on = <S extends z.ZodType<unknown[]>>(
    channel: string,
    schema: S,
    run: (args: z.output<S>) => Promise<IpcResponse>,
  ) => handleGuarded(isTrusted, channel, schema, (_e, args) => run(args));
  const idsOnly = (channel: string, method: string) =>
    on(channel, z.tuple([ids]), ([list]) => rpcHandler(method, { ids: list }));
  const noArgs = (channel: string, method: string) => on(channel, z.tuple([]), () => rpcHandler(method));

  // Torrent actions
  on(
    IPC.RPC_TORRENT_GET,
    z.tuple([fieldNames, z.union([ids, z.literal('recently-active')]).optional()]),
    ([fields, idList]) => rpcHandler('torrent-get', { fields, ...(idList !== undefined && { ids: idList }) }),
  );
  on(IPC.RPC_TORRENT_SET, z.tuple([ids, rpcParamsWithoutIdsSchema]), ([idList, params]) =>
    rpcHandler('torrent-set', { ...params, ids: idList }),
  );
  on(IPC.RPC_TORRENT_ADD, z.tuple([torrentAddSchema]), async ([params]) => {
    try {
      return await rpcHandler('torrent-add', resolveTorrentAddParams(params));
    } catch (err) {
      return { success: false, error: err instanceof ApprovedPathError ? err.message : 'Failed to read torrent file' };
    }
  });
  on(IPC.RPC_TORRENT_REMOVE, z.tuple([ids, z.boolean()]), ([idList, deleteLocalData]) =>
    rpcHandler('torrent-remove', { ids: idList, 'delete-local-data': deleteLocalData }),
  );
  idsOnly(IPC.RPC_TORRENT_START, 'torrent-start');
  idsOnly(IPC.RPC_TORRENT_START_NOW, 'torrent-start-now');
  idsOnly(IPC.RPC_TORRENT_STOP, 'torrent-stop');
  idsOnly(IPC.RPC_TORRENT_VERIFY, 'torrent-verify');
  idsOnly(IPC.RPC_TORRENT_REANNOUNCE, 'torrent-reannounce');
  on(IPC.RPC_TORRENT_SET_LOCATION, z.tuple([ids, pathString, z.boolean()]), ([idList, location, move]) =>
    rpcHandler('torrent-set-location', { ids: idList, location, move }),
  );
  on(IPC.RPC_TORRENT_RENAME_PATH, z.tuple([ids, pathString, z.string().min(1).max(1024)]), ([idList, oldPath, name]) =>
    rpcHandler('torrent-rename-path', { ids: idList, path: oldPath, name }),
  );

  // Queue
  idsOnly(IPC.RPC_QUEUE_MOVE_TOP, 'queue-move-top');
  idsOnly(IPC.RPC_QUEUE_MOVE_UP, 'queue-move-up');
  idsOnly(IPC.RPC_QUEUE_MOVE_DOWN, 'queue-move-down');
  idsOnly(IPC.RPC_QUEUE_MOVE_BOTTOM, 'queue-move-bottom');

  // Session
  on(IPC.RPC_SESSION_GET, z.tuple([fieldNames.optional()]), ([fields]) =>
    rpcHandler('session-get', fields ? { fields } : undefined),
  );
  // Script settings make the daemon run a program: a change needs the user's approval in a native dialog.
  handleGuarded(
    isTrusted,
    IPC.RPC_SESSION_SET,
    z.tuple([rpcParamsSchema]),
    async (event, [params]): Promise<IpcResponse> => {
      // One client for the whole check-then-write: switching server meanwhile cannot redirect the write.
      const client = connectionManager.getActiveClient();
      if (!client) return toIpcError(new RpcError('NO_CONNECTION', 'No active server connection'));
      const window = BrowserWindow.fromWebContents(event.sender);
      const server = configStore.getServers().find((s) => s.id === configStore.getActiveServerId());
      const allowed = await isSessionChangeAllowed(params, {
        fetchCurrent: async (fields) => (await client.request('session-get', { fields: [...fields] })) ?? undefined,
        confirm: (changes) =>
          confirmScriptChanges(window, changes, server && `${server.name} (${server.host}:${server.port})`),
      });
      if (!allowed) return { success: false, error: t('native.scriptGuard.declined'), code: 'CANCELLED' };
      try {
        return { success: true, data: await client.request('session-set', params) };
      } catch (err) {
        return toIpcError(err);
      }
    },
  );
  noArgs(IPC.RPC_SESSION_STATS, 'session-stats');
  noArgs(IPC.RPC_SESSION_CLOSE, 'session-close');

  // Utilities
  on(IPC.RPC_FREE_SPACE, z.tuple([pathString]), ([dir]) => rpcHandler('free-space', { path: dir }));
  noArgs(IPC.RPC_PORT_TEST, 'port-test');
  noArgs(IPC.RPC_BLOCKLIST_UPDATE, 'blocklist-update');
  on(
    IPC.RPC_GROUP_GET,
    z.tuple([z.union([z.string().max(256), z.array(z.string().max(256)).max(200)]).optional()]),
    ([group]) => rpcHandler('group-get', group ? { group } : undefined),
  );
  on(IPC.RPC_GROUP_SET, z.tuple([rpcParamsSchema]), ([params]) => rpcHandler('group-set', params));
}
