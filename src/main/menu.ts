import { Menu, app, shell, BrowserWindow } from 'electron';

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
                click: () => mainWindow.webContents.send('menu:preferences'),
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
          click: () => mainWindow.webContents.send('menu:add-torrent'),
        },
        {
          label: 'Add Magnet Link…',
          accelerator: 'CmdOrCtrl+M',
          click: () => mainWindow.webContents.send('menu:add-magnet'),
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
          click: () => mainWindow.webContents.send('menu:toggle-filter'),
        },
        {
          label: 'Toggle Details Panel',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => mainWindow.webContents.send('menu:toggle-details'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
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
          click: () => mainWindow.webContents.send('menu:torrent-start'),
        },
        {
          label: 'Stop',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.send('menu:torrent-stop'),
        },
        { type: 'separator' },
        {
          label: 'Verify',
          click: () => mainWindow.webContents.send('menu:torrent-verify'),
        },
        {
          label: 'Reannounce',
          click: () => mainWindow.webContents.send('menu:torrent-reannounce'),
        },
        { type: 'separator' },
        {
          label: 'Start All',
          click: () => mainWindow.webContents.send('menu:start-all'),
        },
        {
          label: 'Stop All',
          click: () => mainWindow.webContents.send('menu:stop-all'),
        },
        { type: 'separator' },
        {
          label: 'Remove…',
          accelerator: 'Delete',
          click: () => mainWindow.webContents.send('menu:torrent-remove'),
        },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Server Settings…',
          click: () => mainWindow.webContents.send('menu:settings'),
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: 'Preferences…',
                click: () => mainWindow.webContents.send('menu:preferences'),
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
            shell.openExternal('https://github.com/transmission-remote-gui/transgui/issues'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
