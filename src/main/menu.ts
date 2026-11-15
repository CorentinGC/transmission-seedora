import { app, Menu, shell, BrowserWindow } from 'electron';
import { IPC } from '@shared/ipc-channels';

export function createMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Seedora',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Preferences…',
                accelerator: 'CmdOrCtrl+,',
                click: () => mainWindow.webContents.send(IPC.MENU_PREFERENCES),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Torrent…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send(IPC.MENU_ADD_TORRENT),
        },
        {
          label: 'Add Magnet Link…',
          accelerator: 'CmdOrCtrl+M',
          click: () => mainWindow.webContents.send(IPC.MENU_ADD_MAGNET),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Filter Sidebar',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => mainWindow.webContents.send(IPC.MENU_TOGGLE_FILTER),
        },
        {
          label: 'Toggle Details Panel',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => mainWindow.webContents.send(IPC.MENU_TOGGLE_DETAILS),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }]),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Torrent',
      submenu: [
        {
          label: 'Start',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_START),
        },
        {
          label: 'Stop',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_STOP),
        },
        { type: 'separator' },
        {
          label: 'Verify',
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_VERIFY),
        },
        {
          label: 'Reannounce',
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_REANNOUNCE),
        },
        { type: 'separator' },
        {
          label: 'Start All',
          click: () => mainWindow.webContents.send(IPC.MENU_START_ALL),
        },
        {
          label: 'Stop All',
          click: () => mainWindow.webContents.send(IPC.MENU_STOP_ALL),
        },
        { type: 'separator' },
        {
          label: 'Remove…',
          accelerator: 'Delete',
          click: () => mainWindow.webContents.send(IPC.MENU_TORRENT_REMOVE),
        },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Server Settings…',
          click: () => mainWindow.webContents.send(IPC.MENU_SETTINGS),
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: 'Preferences…',
                click: () => mainWindow.webContents.send(IPC.MENU_PREFERENCES),
              },
            ]
          : []),
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Transmission RPC Spec',
          click: () =>
            shell.openExternal(
              'https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md',
            ),
        },
        {
          label: 'Report an Issue',
          click: () =>
            shell.openExternal('https://github.com/CorentinGC/transmission-seedora/issues'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
