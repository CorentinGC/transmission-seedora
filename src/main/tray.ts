import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'node:path';

let tray: Tray | null = null;

interface TrayState {
  downloadSpeed: number;
  uploadSpeed: number;
  activeCount: number;
  altSpeedEnabled: boolean;
}

function formatSpeed(bytes: number): string {
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
}

function getIconPath(): string {
  if (process.platform === 'darwin') {
    return path.join(__dirname, '../../resources/tray-iconTemplate.png');
  }
  return path.join(__dirname, '../../resources/tray-icon.png');
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = nativeImage.createFromPath(getIconPath());
  // Fallback: create a small empty icon if file doesn't exist
  const trayIcon = icon.isEmpty()
    ? nativeImage.createEmpty()
    : icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('Transmission Remote');

  updateTrayMenu(mainWindow, {
    downloadSpeed: 0,
    uploadSpeed: 0,
    activeCount: 0,
    altSpeedEnabled: false,
  });

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

export function updateTrayMenu(mainWindow: BrowserWindow, state: TrayState): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `↓ ${formatSpeed(state.downloadSpeed)}  ↑ ${formatSpeed(state.uploadSpeed)}`,
      enabled: false,
    },
    {
      label: `${state.activeCount} active transfer(s)`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: state.altSpeedEnabled ? 'Disable Alt Speed' : 'Enable Alt Speed',
      click: () => {
        mainWindow.webContents.send('tray:toggle-alt-speed');
      },
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(
    `Transmission Remote\n↓ ${formatSpeed(state.downloadSpeed)}  ↑ ${formatSpeed(state.uploadSpeed)}`,
  );
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
