import { app, BrowserWindow, Notification } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HotkeyController } from './hotkeys';
import { registerIpcHandlers } from './ipc';
import { StateRepository } from './state';
import { createTray } from './tray';
import { createWin32Service } from './win32';
import { WindowManager } from './window-manager';

let mainWindow: BrowserWindow | null = null;
let stateRepository: StateRepository | null = null;
let hotkeys: HotkeyController | null = null;

const logPath = join(app.getPath('userData'), 'spacetoggle-main.log');

const log = (message: string, error?: unknown): void => {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    const detail =
      error instanceof Error
        ? `${error.stack ?? error.message}`
        : typeof error === 'undefined'
          ? ''
          : String(error);
    appendFileSync(logPath, `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ''}\n`);
  } catch {
    // Logging must never prevent startup.
  }
};

const createMainWindow = (): BrowserWindow => {
  log('Creating main window');
  const window = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 880,
    minHeight: 560,
    show: false,
    title: 'SpaceToggle',
    backgroundColor: '#f7f7f2',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, '../preload/index.js')
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    log(`Loading dev renderer: ${process.env.ELECTRON_RENDERER_URL}`);
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    const rendererPath = join(__dirname, '../renderer/index.html');
    log(`Loading packaged renderer: ${rendererPath}`);
    window.loadFile(rendererPath);
  }

  return window;
};

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    log('Second instance requested');
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    log('App ready');
    stateRepository = new StateRepository();
    stateRepository.markSessionStarted();
    log('State repository initialized');

    const win32 = createWin32Service();
    log(`Win32 service available: ${win32.isAvailable}`);
    const windowManager = new WindowManager(stateRepository, win32);
    const recoveryResult = windowManager.recoverAfterCrashIfNeeded();

    mainWindow = createMainWindow();
    hotkeys = new HotkeyController(windowManager);
    const hotkeyStatus = hotkeys.register();
    log(`Hotkey registered: ${hotkeyStatus.registered}`);

    registerIpcHandlers(stateRepository, windowManager, hotkeys);
    createTray(mainWindow, windowManager);
    log('IPC and tray initialized');

    if (recoveryResult && !recoveryResult.ok) {
      new Notification({
        title: 'SpaceToggle recovery warning',
        body: recoveryResult.message
      }).show();
    }

    if (!hotkeyStatus.registered) {
      new Notification({
        title: 'SpaceToggle hotkey unavailable',
        body: hotkeyStatus.error ?? 'Hotkey registration failed.'
      }).show();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  }).catch((error) => {
    log('App startup failed', error);
    app.quit();
  });
}

app.on('before-quit', () => {
  log('Before quit');
  hotkeys?.unregisterAll();
  stateRepository?.markCleanShutdown();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  log('Uncaught exception', error);
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  log('Unhandled rejection', error);
  console.error('Unhandled rejection:', error);
});
