import { app, Menu, shell, BrowserWindow } from 'electron';
import { IPC } from '@ipc/ipc-channels';
import { t } from './i18n/main-i18n';

const APP_NAME = 'Seedora';
const m = (key: string, vars?: Record<string, string | number>) => t(`native.menu.${key}`, vars);

/** Builds and installs the application menu in the current language; call again after a language change. */
export function createMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about' as const, label: m('about', { appName: APP_NAME }) },
              { type: 'separator' as const },
              {
                label: m('preferences'),
                accelerator: 'CmdOrCtrl+,',
                click: () => mainWindow.webContents.send(IPC.MENU_PREFERENCES),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const, label: m('hide', { appName: APP_NAME }) },
              { role: 'hideOthers' as const, label: m('hideOthers') },
              { role: 'unhide' as const, label: m('unhide') },
              { type: 'separator' as const },
              { role: 'quit' as const, label: m('quit', { appName: APP_NAME }) },
            ],
          },
        ]
      : []),
    {
      label: m('file'),
      submenu: [
        {
          label: m('addTorrent'),
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send(IPC.MENU_ADD_TORRENT),
        },
        {
          label: m('addMagnet'),
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => mainWindow.webContents.send(IPC.MENU_ADD_MAGNET),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: m('close') } : { role: 'quit', label: m('quit', { appName: APP_NAME }) },
      ],
    },
    {
      label: m('edit'),
      submenu: [
        { role: 'undo', label: m('undo') },
        { role: 'redo', label: m('redo') },
        { type: 'separator' },
        { role: 'cut', label: m('cut') },
        { role: 'copy', label: m('copy') },
        { role: 'paste', label: m('paste') },
        { role: 'selectAll', label: m('selectAll') },
      ],
    },
    {
      label: m('view'),
      submenu: [
        {
          label: m('toggleFilter'),
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => mainWindow.webContents.send(IPC.MENU_TOGGLE_FILTER),
        },
        {
          label: m('toggleDetails'),
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => mainWindow.webContents.send(IPC.MENU_TOGGLE_DETAILS),
        },
        { type: 'separator' },
        { role: 'reload', label: m('reload') },
        { role: 'forceReload', label: m('forceReload') },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }]),
        { type: 'separator' },
        { role: 'resetZoom', label: m('resetZoom') },
        { role: 'zoomIn', label: m('zoomIn') },
        { role: 'zoomOut', label: m('zoomOut') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: m('toggleFullscreen') },
      ],
    },
    {
      label: m('torrent'),
      submenu: [
        {
          label: m('start'),
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_START),
        },
        {
          label: m('stop'),
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_STOP),
        },
        { type: 'separator' },
        {
          label: m('verify'),
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_VERIFY),
        },
        {
          label: m('reannounce'),
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_REANNOUNCE),
        },
        { type: 'separator' },
        {
          label: m('startAll'),
          click: () => mainWindow.webContents.send(IPC.MENU_START_ALL),
        },
        {
          label: m('stopAll'),
          click: () => mainWindow.webContents.send(IPC.MENU_STOP_ALL),
        },
        { type: 'separator' },
        {
          // No accelerator: a menu accelerator on Delete captures the key in text inputs. The renderer
          // handles the Delete key itself (it can see focus and selection).
          label: m('remove'),
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_REMOVE),
        },
      ],
    },
    {
      label: m('tools'),
      submenu: [
        {
          label: m('serverSettings'),
          click: () => mainWindow.webContents.send(IPC.MENU_SETTINGS),
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: m('preferences'),
                click: () => mainWindow.webContents.send(IPC.MENU_PREFERENCES),
              },
            ]
          : []),
      ],
    },
    {
      role: 'help',
      label: m('help'),
      submenu: [
        {
          label: m('rpcSpec'),
          click: () =>
            shell.openExternal(
              'https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md',
            ),
        },
        {
          label: m('reportIssue'),
          click: () =>
            shell.openExternal('https://github.com/CorentinGC/transmission-seedora/issues'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
