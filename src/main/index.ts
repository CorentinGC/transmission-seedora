import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc/handlers';
import { createTray, updateTrayMenu, destroyTray } from './tray';
import { createMenu } from './menu';
import { startWatcher, stopWatcher, restartWatcher } from './watcher';
import { configStore } from './store/config-store';
import { IPC } from '@shared/ipc-channels';

if (started) {
  app.quit();
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let forceQuit = false;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Native menu
  createMenu(mainWindow);

  // System tray
  const prefs = configStore.getPreferences();
  if (prefs.minimizeToTray || prefs.closeToTray) {
    createTray(mainWindow);
  }

  // Minimize to tray
  mainWindow.on('minimize', () => {
    const currentPrefs = configStore.getPreferences();
    if (currentPrefs.minimizeToTray && mainWindow) {
      mainWindow.hide();
    }
  });

  // Close to tray
  mainWindow.on('close', (e) => {
    if (forceQuit) return;
    const currentPrefs = configStore.getPreferences();
    if (currentPrefs.closeToTray && mainWindow) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Start watch folder
  startWatcher().catch((err) => console.error('[Watcher] Init error:', err));
};

// Tray update from renderer
ipcMain.on(IPC.TRAY_UPDATE, (_event, state) => {
  if (mainWindow) {
    updateTrayMenu(mainWindow, state);
  }
});

// Notification from renderer
ipcMain.on(IPC.NOTIFICATION_SHOW, (_event, { title, body }: { title: string; body: string }) => {
  const prefs = configStore.getPreferences();
  if (!prefs.showNotifications) return;

  const notification = new Notification({ title, body });
  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  notification.show();
});

// Watcher restart
ipcMain.on(IPC.WATCHER_RESTART, () => {
  restartWatcher();
});

// Tray alt-speed toggle relay
ipcMain.on('tray:toggle-alt-speed', () => {
  if (mainWindow) {
    mainWindow.webContents.send('tray:toggle-alt-speed');
  }
});

registerIpcHandlers();

app.on('ready', createWindow);

app.on('before-quit', () => {
  forceQuit = true;
  stopWatcher().catch(() => {});
  destroyTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

export { mainWindow };
