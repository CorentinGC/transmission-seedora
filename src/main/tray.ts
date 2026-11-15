import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'node:path';
import { IPC } from '@ipc/ipc-channels';
import { t } from './i18n/main-i18n';

let tray: Tray | null = null;
let lastWindow: BrowserWindow | null = null;
let lastState: TrayState = { downloadSpeed: 0, uploadSpeed: 0, activeCount: 0, altSpeedEnabled: false };

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

/** Creates the tray icon and its menu. */
export function createTray(mainWindow: BrowserWindow): Tray {
  tray?.destroy(); // a re-created window (macOS) must not leave a second tray icon behind
  const icon = nativeImage.createFromPath(getIconPath());
  // Fallback: create a small empty icon if file doesn't exist
  const trayIcon = icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('Seedora');

  updateTrayMenu(mainWindow, lastState);

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

/** Rebuilds the tray menu and tooltip from the renderer's latest state. */
export function updateTrayMenu(mainWindow: BrowserWindow, state: TrayState): void {
  lastWindow = mainWindow;
  lastState = state;
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `↓ ${formatSpeed(state.downloadSpeed)}  ↑ ${formatSpeed(state.uploadSpeed)}`,
      enabled: false,
    },
    {
      label: t('native.tray.activeTransfers', { count: state.activeCount }),
      enabled: false,
    },
    { type: 'separator' },
    {
      label: state.altSpeedEnabled ? t('native.tray.disableAltSpeed') : t('native.tray.enableAltSpeed'),
      click: () => {
        mainWindow.webContents.send(IPC.TRAY_TOGGLE_ALT_SPEED);
      },
    },
    { type: 'separator' },
    {
      label: t('native.tray.showWindow'),
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: t('native.tray.quit'),
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`Seedora\n↓ ${formatSpeed(state.downloadSpeed)}  ↑ ${formatSpeed(state.uploadSpeed)}`);
}

/** Rebuilds the tray menu with the last known state, e.g. after a language change. */
export function refreshTrayLabels(): void {
  if (lastWindow) updateTrayMenu(lastWindow, lastState);
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
