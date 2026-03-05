import type { PlatformApi } from '@shared/platform/api-types';

/**
 * Electron implementation of PlatformApi.
 * Delegates all calls to window.api (provided by preload.ts via contextBridge).
 */
export const electronApi: PlatformApi = {
  // Server management
  serverList: () => window.api.serverList(),
  serverAdd: (config) => window.api.serverAdd(config),
  serverUpdate: (id, updates) => window.api.serverUpdate(id, updates),
  serverRemove: (id) => window.api.serverRemove(id),
  serverSetActive: (id) => window.api.serverSetActive(id),
  serverTest: (config) => window.api.serverTest(config),

  // RPC torrent
  rpcTorrentGet: (fields, ids) => window.api.rpcTorrentGet(fields, ids),
  rpcTorrentSet: (ids, params) => window.api.rpcTorrentSet(ids, params),
  rpcTorrentAdd: (params) => window.api.rpcTorrentAdd(params),
  rpcTorrentRemove: (ids, deleteLocalData) => window.api.rpcTorrentRemove(ids, deleteLocalData),
  rpcTorrentStart: (ids) => window.api.rpcTorrentStart(ids),
  rpcTorrentStartNow: (ids) => window.api.rpcTorrentStartNow(ids),
  rpcTorrentStop: (ids) => window.api.rpcTorrentStop(ids),
  rpcTorrentVerify: (ids) => window.api.rpcTorrentVerify(ids),
  rpcTorrentReannounce: (ids) => window.api.rpcTorrentReannounce(ids),
  rpcTorrentSetLocation: (ids, location, move) => window.api.rpcTorrentSetLocation(ids, location, move),
  rpcTorrentRenamePath: (ids, path, name) => window.api.rpcTorrentRenamePath(ids, path, name),

  // RPC queue
  rpcQueueMoveTop: (ids) => window.api.rpcQueueMoveTop(ids),
  rpcQueueMoveUp: (ids) => window.api.rpcQueueMoveUp(ids),
  rpcQueueMoveDown: (ids) => window.api.rpcQueueMoveDown(ids),
  rpcQueueMoveBottom: (ids) => window.api.rpcQueueMoveBottom(ids),

  // RPC session
  rpcSessionGet: (fields) => window.api.rpcSessionGet(fields),
  rpcSessionSet: (params) => window.api.rpcSessionSet(params),
  rpcSessionStats: () => window.api.rpcSessionStats(),
  rpcSessionClose: () => window.api.rpcSessionClose(),

  // RPC utilities
  rpcFreeSpace: (path) => window.api.rpcFreeSpace(path),
  rpcPortTest: () => window.api.rpcPortTest(),
  rpcBlocklistUpdate: () => window.api.rpcBlocklistUpdate(),
  rpcGroupGet: (group) => window.api.rpcGroupGet(group),
  rpcGroupSet: (params) => window.api.rpcGroupSet(params),

  // Config export/import
  configExport: (options) => window.api.configExport(options),
  configImport: (data) => window.api.configImport(data),

  // Preferences
  prefsGet: () => window.api.prefsGet(),
  prefsSet: (prefs) => window.api.prefsSet(prefs),

  // Platform-specific (Electron-only)
  dialogOpenFile: (options) => window.api.dialogOpenFile(options),
  dialogOpenDirectory: () => window.api.dialogOpenDirectory(),
  dialogSaveFile: (options, content) => window.api.dialogSaveFile(options, content),
  trayUpdate: (state) => window.api.trayUpdate(state),
  notificationShow: (title, body) => window.api.notificationShow(title, body),
  watcherRestart: () => window.api.watcherRestart(),
  geoipLookup: (ips) => window.api.geoipLookup(ips),
  onMenuEvent: (channel, callback) => window.api.onMenuEvent(channel, callback),
};
