import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../shared/ipc';
import type { GroupName, Mode, WindowIdentity } from '../shared/types';
import type { HotkeyController } from './hotkeys';
import type { StateRepository } from './state';
import type { WindowManager } from './window-manager';

const modeSchema = z.string().trim().min(1);
const identitySchema = z.object({
  processPath: z.string().trim().min(1).max(2048),
  titlePattern: z.string().trim().min(1).max(512),
  className: z.string().trim().max(256).optional()
});

const groupIdentitySchema = z.object({
  group: z.string().trim().min(1),
  identity: identitySchema
});

const categoryIdentitySchema = z.object({
  categoryId: z.string().trim().min(1),
  identity: identitySchema
});

export const registerIpcHandlers = (
  state: StateRepository,
  windows: WindowManager,
  hotkeys: HotkeyController
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
    const mode = modeSchema.parse(payload) as string;
    return windows.setMode(mode);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_WINDOW_TO_GROUP, (_event, payload: unknown) => {
    const parsed = groupIdentitySchema.parse(payload);
    return windows.addToGroup(parsed.group, parsed.identity);
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_WINDOW_FROM_GROUP, (_event, payload: unknown) => {
    const parsed = groupIdentitySchema.parse(payload);
    return windows.removeFromGroup(parsed.group, parsed.identity);
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_CATEGORY, (_event, payload: unknown) => {
    const name = z.string().trim().min(1).max(256).parse(payload);
    return windows.createCategory(name);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_CATEGORY, (_event, payload: unknown) => {
    const id = z.string().trim().min(1).parse(payload);
    return windows.deleteCategory(id);
  });

  ipcMain.handle(IPC_CHANNELS.RENAME_CATEGORY, (_event, payload: unknown) => {
    const parsed = z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1).max(256)
    }).parse(payload);
    return windows.renameCategory(parsed.id, parsed.name);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_WINDOW_TO_CATEGORY, (_event, payload: unknown) => {
    const parsed = categoryIdentitySchema.parse(payload);
    return windows.addWindowToCategory(parsed.categoryId, parsed.identity);
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_WINDOW_FROM_CATEGORY, (_event, payload: unknown) => {
    const parsed = categoryIdentitySchema.parse(payload);
    return windows.removeWindowFromCategory(parsed.categoryId, parsed.identity);
  });
};

