import { app, BrowserWindow, Notification } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc/handlers';
import { createTray, updateTrayMenu, destroyTray } from './tray';
import { createMenu } from './menu';
import { startWatcher, stopWatcher, restartWatcher } from './watcher';
import { configStore } from './store/config-store';
import { z } from 'zod';
import { IPC } from '@shared/ipc-channels';
import { buildTrustedOrigins, createSenderValidator } from './security/sender';
import { listenGuarded } from './security/ipc-guard';
import { denyAllPermissions, guardWebContents } from './security/window-guards';
import { APP_INDEX_URL, APP_ORIGIN } from './security/app-protocol';
import { registerAppScheme, serveRendererFrom } from './security/app-scheme';
import { notificationSchema, trayStateSchema } from './security/schemas';

// One instance only, claimed before anything is registered: a second launch quits here and focuses the
// existing window (see `second-instance`) instead of opening another one.
const hasSingleInstanceLock = !started && app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let forceQuit = false;

// The scheme must be declared before `ready`.
registerAppScheme();

const rendererRoot = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
const trustedOrigins = buildTrustedOrigins(MAIN_WINDOW_VITE_DEV_SERVER_URL || undefined, app.isPackaged, APP_ORIGIN);
const isTrustedSender = createSenderValidator(trustedOrigins);

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
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL(APP_INDEX_URL);
  }

  if (!app.isPackaged && process.env.NODE_ENV === 'development') {
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

/** Registers the renderer-facing IPC listeners, handlers and web contents guards (first instance only). */
function registerMainProcessHandlers(): void {
  // Tray update from renderer
  listenGuarded(isTrustedSender, IPC.TRAY_UPDATE, z.tuple([trayStateSchema]), (_event, [state]) => {
    if (mainWindow) {
      updateTrayMenu(mainWindow, state);
    }
  });

  // Notification from renderer
  listenGuarded(isTrustedSender, IPC.NOTIFICATION_SHOW, z.tuple([notificationSchema]), (_event, [{ title, body }]) => {
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
  listenGuarded(isTrustedSender, IPC.WATCHER_RESTART, z.tuple([]), () => {
    restartWatcher().catch((err) => console.error('[Watcher] Restart error:', err));
  });

  registerIpcHandlers(isTrustedSender);
  guardWebContents(trustedOrigins);
}

if (hasSingleInstanceLock) {
  registerMainProcessHandlers();
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('ready', () => {
  if (!hasSingleInstanceLock) return;
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) serveRendererFrom(rendererRoot);
  denyAllPermissions(trustedOrigins);
  createWindow();
});

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
