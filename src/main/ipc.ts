import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../shared/ipc';
import type { GroupName, Mode, WindowIdentity, DropZoneState } from '../shared/types';
import type { HotkeyController } from './hotkeys';
import type { StateRepository } from './state';
import type { WindowManager } from './window-manager';

const groupSchema = z.enum(['work', 'play']);
const modeSchema = z.enum(['WORK', 'PLAY', 'NEUTRAL']);
const identitySchema = z.object({
  processPath: z.string().trim().min(1).max(2048),
  titlePattern: z.string().trim().min(1).max(512),
  className: z.string().trim().max(256).optional()
});

const groupIdentitySchema = z.object({
  group: groupSchema,
  identity: identitySchema
});

export const registerIpcHandlers = (
  state: StateRepository,
  windows: WindowManager,
  hotkeys: HotkeyController,
  getDropZoneWindow: () => BrowserWindow | null
): void => {
  ipcMain.handle(IPC_CHANNELS.GET_STATE, () => state.get());
  ipcMain.handle(IPC_CHANNELS.LIST_WINDOWS, () => windows.listWindows());
  ipcMain.handle(IPC_CHANNELS.GET_HOTKEY_STATUS, () => hotkeys.getStatus());
  ipcMain.handle(IPC_CHANNELS.UPDATE_HOTKEY, (_event, payload: unknown) => {
    const accelerator = z.string().trim().min(1).parse(payload);
    return hotkeys.update(accelerator);
  });
  ipcMain.handle(IPC_CHANNELS.TOGGLE_MODE, () => windows.toggleMode());
  ipcMain.handle(IPC_CHANNELS.FORCE_RESTORE, () => windows.forceRestore());
  ipcMain.handle(IPC_CHANNELS.EXCLUDE_FROM_ALT_TAB, (_event, payload: unknown) => {
    const identity = identitySchema.parse(payload) as WindowIdentity;
    return windows.excludeFromAltTab(identity);
  });
  ipcMain.handle(IPC_CHANNELS.RESTORE_WINDOW_VISUALS, (_event, payload: unknown) => {
    const identity = identitySchema.parse(payload) as WindowIdentity;
    return windows.restoreWindowVisuals(identity);
  });

  ipcMain.handle(IPC_CHANNELS.SET_MODE, (_event, payload: unknown) => {
    const mode = modeSchema.parse(payload) as Mode;
    return windows.setMode(mode);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_WINDOW_TO_GROUP, (_event, payload: unknown) => {
    const parsed = groupIdentitySchema.parse(payload) as {
      group: GroupName;
      identity: WindowIdentity;
    };
    return windows.addToGroup(parsed.group, parsed.identity);
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_WINDOW_FROM_GROUP, (_event, payload: unknown) => {
    const parsed = groupIdentitySchema.parse(payload) as {
      group: GroupName;
      identity: WindowIdentity;
    };
    return windows.removeFromGroup(parsed.group, parsed.identity);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DROPZONE_CONFIG, (_event, payload: unknown) => {
    const config = payload as Partial<Omit<DropZoneState, 'capturedWindows'>>;
    const nextState = state.updateDropZoneConfig(config);
    const dzWin = getDropZoneWindow();
    if (dzWin && !dzWin.isDestroyed()) {
      const dz = nextState.dropZone;
      if (
        config.x !== undefined ||
        config.y !== undefined ||
        config.width !== undefined ||
        config.height !== undefined
      ) {
        dzWin.setBounds({
          x: Math.round(dz.x),
          y: Math.round(dz.y),
          width: Math.round(dz.width),
          height: Math.round(dz.height)
        });
      }
      if (config.opacity !== undefined) {
        dzWin.setOpacity(dz.opacity);
      }
      if (config.visible !== undefined) {
        if (dz.visible) {
          dzWin.show();
        } else {
          dzWin.hide();
        }
      }
    }
    return nextState;
  });

  ipcMain.on(IPC_CHANNELS.SET_IGNORE_MOUSE_EVENTS, (event, ignore: boolean, options?: { forward: boolean }) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });
};
