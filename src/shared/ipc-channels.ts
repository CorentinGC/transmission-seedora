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
  READ_FILE_BASE64: 'file:read-base64',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',

  // Tray
  TRAY_UPDATE: 'tray:update',

  // Notifications
  NOTIFICATION_SHOW: 'notification:show',

  // Watcher
  WATCHER_RESTART: 'watcher:restart',

  // Config export/import
  CONFIG_EXPORT: 'config:export',
  CONFIG_SECRET_STORAGE: 'config:secret-storage',
  CONFIG_IMPORT: 'config:import',
  DIALOG_SAVE_FILE: 'dialog:save-file',

  // GeoIP
  GEOIP_LOOKUP: 'geoip:lookup',

  // Magnet links and .torrent files opened through the OS
  LAUNCH_TAKE: 'launch:take',
  LAUNCH_TARGET: 'launch:target',

  // Main -> renderer events (native menu and tray)
  MENU_PREFERENCES: 'menu:preferences',
  MENU_ADD_TORRENT: 'menu:add-torrent',
  MENU_ADD_MAGNET: 'menu:add-magnet',
  MENU_TOGGLE_FILTER: 'menu:toggle-filter',
  MENU_TOGGLE_DETAILS: 'menu:toggle-details',
  MENU_TORRENT_START: 'menu:torrent-start',
  MENU_TORRENT_STOP: 'menu:torrent-stop',
  MENU_TORRENT_VERIFY: 'menu:torrent-verify',
  MENU_TORRENT_REANNOUNCE: 'menu:torrent-reannounce',
  MENU_START_ALL: 'menu:start-all',
  MENU_STOP_ALL: 'menu:stop-all',
  MENU_TORRENT_REMOVE: 'menu:torrent-remove',
  MENU_SETTINGS: 'menu:settings',
  TRAY_TOGGLE_ALT_SPEED: 'tray:toggle-alt-speed',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** Main -> renderer channels the preload lets the renderer subscribe to (nothing else). */
export const RENDERER_EVENT_CHANNELS: readonly string[] = [
  IPC.MENU_PREFERENCES,
  IPC.MENU_ADD_TORRENT,
  IPC.MENU_ADD_MAGNET,
  IPC.MENU_TOGGLE_FILTER,
  IPC.MENU_TOGGLE_DETAILS,
  IPC.MENU_TORRENT_START,
  IPC.MENU_TORRENT_STOP,
  IPC.MENU_TORRENT_VERIFY,
  IPC.MENU_TORRENT_REANNOUNCE,
  IPC.MENU_START_ALL,
  IPC.MENU_STOP_ALL,
  IPC.MENU_TORRENT_REMOVE,
  IPC.MENU_SETTINGS,
  IPC.TRAY_TOGGLE_ALT_SPEED,
  IPC.LAUNCH_TARGET,
];
