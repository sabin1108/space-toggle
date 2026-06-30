import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { GroupName, Mode, SpaceToggleApi, WindowIdentity } from '../shared/types';

const api: SpaceToggleApi = {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_STATE),
  listWindows: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_WINDOWS),
  addWindowToGroup: (group: string, identity: WindowIdentity) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_WINDOW_TO_GROUP, { group, identity }),
  removeWindowFromGroup: (group: string, identity: WindowIdentity) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_WINDOW_FROM_GROUP, { group, identity }),
  setMode: (mode: string) => ipcRenderer.invoke(IPC_CHANNELS.SET_MODE, mode),
  toggleMode: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_MODE),
  excludeFromAltTab: (identity: WindowIdentity) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXCLUDE_FROM_ALT_TAB, identity),
  restoreWindowVisuals: (identity: WindowIdentity) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESTORE_WINDOW_VISUALS, identity),
  forceRestore: () => ipcRenderer.invoke(IPC_CHANNELS.FORCE_RESTORE),
  getHotkeyStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_HOTKEY_STATUS),
  updateHotkey: (accelerator: string) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_HOTKEY, accelerator),
  createCategory: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_CATEGORY, name),
  deleteCategory: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CATEGORY, id),
  renameCategory: (id: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.RENAME_CATEGORY, { id, name }),
  addWindowToCategory: (categoryId: string, identity: WindowIdentity) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_WINDOW_TO_CATEGORY, { categoryId, identity }),
  removeWindowFromCategory: (categoryId: string, identity: WindowIdentity) =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_WINDOW_FROM_CATEGORY, { categoryId, identity })
};

contextBridge.exposeInMainWorld('spaceToggle', api);
