import { Menu, Tray, app, nativeImage } from 'electron';
import type { BrowserWindow } from 'electron';
import type { WindowManager } from './window-manager';

export const createTray = (mainWindow: BrowserWindow, windowManager: WindowManager): Tray => {
  const tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('SpaceToggle');

  const showWindow = (): void => {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  };

  const rebuild = (): void => {
    const state = windowManager.forceRestore;
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Open SpaceToggle',
          click: showWindow
        },
        {
          label: 'Force restore all windows',
          click: () => {
            state.call(windowManager);
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => app.quit()
        }
      ])
    );
  };

  rebuild();
  tray.on('click', showWindow);

  return tray;
};

