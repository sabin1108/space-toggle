export const IPC_CHANNELS = {
  GET_STATE: 'spacetoggle:get-state',
  LIST_WINDOWS: 'spacetoggle:list-windows',
  ADD_WINDOW_TO_GROUP: 'spacetoggle:add-window-to-group',
  REMOVE_WINDOW_FROM_GROUP: 'spacetoggle:remove-window-from-group',
  SET_MODE: 'spacetoggle:set-mode',
  TOGGLE_MODE: 'spacetoggle:toggle-mode',
  EXCLUDE_FROM_ALT_TAB: 'spacetoggle:exclude-from-alt-tab',
  RESTORE_WINDOW_VISUALS: 'spacetoggle:restore-window-visuals',
  FORCE_RESTORE: 'spacetoggle:force-restore',
  GET_HOTKEY_STATUS: 'spacetoggle:get-hotkey-status',
  UPDATE_HOTKEY: 'spacetoggle:update-hotkey',
  CREATE_CATEGORY: 'spacetoggle:create-category',
  DELETE_CATEGORY: 'spacetoggle:delete-category',
  RENAME_CATEGORY: 'spacetoggle:rename-category',
  ADD_WINDOW_TO_CATEGORY: 'spacetoggle:add-window-to-category',
  REMOVE_WINDOW_FROM_CATEGORY: 'spacetoggle:remove-window-from-category',
  UPDATE_DROPZONE_CONFIG: 'spacetoggle:update-dropzone-config',
  SET_IGNORE_MOUSE_EVENTS: 'spacetoggle:set-ignore-mouse-events'
} as const;

