export const IPC = {
  // Server config management
  SERVER_LIST: 'server:list',
  SERVER_ADD: 'server:add',
  SERVER_UPDATE: 'server:update',
  SERVER_REMOVE: 'server:remove',
  SERVER_SET_ACTIVE: 'server:set-active',
  SERVER_TEST: 'server:test',

  // RPC torrent actions
  RPC_TORRENT_GET: 'rpc:torrent-get',
  RPC_TORRENT_SET: 'rpc:torrent-set',
  RPC_TORRENT_ADD: 'rpc:torrent-add',
  RPC_TORRENT_REMOVE: 'rpc:torrent-remove',
  RPC_TORRENT_START: 'rpc:torrent-start',
  RPC_TORRENT_START_NOW: 'rpc:torrent-start-now',
  RPC_TORRENT_STOP: 'rpc:torrent-stop',
  RPC_TORRENT_VERIFY: 'rpc:torrent-verify',
  RPC_TORRENT_REANNOUNCE: 'rpc:torrent-reannounce',
  RPC_TORRENT_SET_LOCATION: 'rpc:torrent-set-location',
  RPC_TORRENT_RENAME_PATH: 'rpc:torrent-rename-path',

  // RPC queue
  RPC_QUEUE_MOVE_TOP: 'rpc:queue-move-top',
  RPC_QUEUE_MOVE_UP: 'rpc:queue-move-up',
  RPC_QUEUE_MOVE_DOWN: 'rpc:queue-move-down',
  RPC_QUEUE_MOVE_BOTTOM: 'rpc:queue-move-bottom',

  // RPC session
  RPC_SESSION_GET: 'rpc:session-get',
  RPC_SESSION_SET: 'rpc:session-set',
  RPC_SESSION_STATS: 'rpc:session-stats',
  RPC_SESSION_CLOSE: 'rpc:session-close',

  // RPC utilities
  RPC_FREE_SPACE: 'rpc:free-space',
  RPC_PORT_TEST: 'rpc:port-test',
  RPC_BLOCKLIST_UPDATE: 'rpc:blocklist-update',
  RPC_GROUP_GET: 'rpc:group-get',
  RPC_GROUP_SET: 'rpc:group-set',

  // Preferences
  PREFS_GET: 'prefs:get',
  PREFS_SET: 'prefs:set',

  // File dialog
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',

  // Tray
  TRAY_UPDATE: 'tray:update',

  // Notifications
  NOTIFICATION_SHOW: 'notification:show',

  // Watcher
  WATCHER_RESTART: 'watcher:restart',

  // GeoIP
  GEOIP_LOOKUP: 'geoip:lookup',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
