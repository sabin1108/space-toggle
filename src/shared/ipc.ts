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
  UPDATE_HOTKEY: 'spacetoggle:update-hotkey'
} as const;
