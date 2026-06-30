export type Mode = 'NEUTRAL' | string;

export type GroupName = string;

export interface Category {
  id: string;
  name: string;
  windows: WindowIdentity[];
}

export interface WindowIdentity {
  processPath: string;
  titlePattern: string;
  className?: string;
}

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowSnapshot {
  id: string;
  title: string;
  processPath: string;
  className?: string;
  rect: WindowRect | null;
  isVisible: boolean;
  identity: WindowIdentity;
  thumbnail?: string;
}

export interface DropZoneState {
  x: number;
  y: number;
  width: number;
  height: number;
  isTransparentMode: boolean; // if true, captured windows become transparent. If false, off-screen fallback.
  capturedWindows: WindowIdentity[];
}

export interface ModifiedWindowRecord {
  identity: WindowIdentity;
  originalRect: WindowRect | null;
  originalExStyle: number;
  type: 'TRANSPARENT' | 'OFFSCREEN' | 'HIDDEN';
}

export interface AppState {
  schemaVersion: number;
  currentMode: Mode;
  categories: Category[];
  dropZone: DropZoneState;
  modifiedWindows: ModifiedWindowRecord[];
  lastCleanShutdown: boolean;
  customHotkey?: string;
}

export interface OperationResult {
  ok: boolean;
  message: string;
  changedCount?: number;
  failures?: string[];
}

export interface HotkeyStatus {
  accelerator: string;
  registered: boolean;
  error?: string;
}

export interface SpaceToggleApi {
  getState(): Promise<AppState>;
  listWindows(): Promise<WindowSnapshot[]>;
  addWindowToGroup(group: string, identity: WindowIdentity): Promise<AppState>;
  removeWindowFromGroup(group: string, identity: WindowIdentity): Promise<AppState>;
  setMode(mode: string): Promise<OperationResult>;
  toggleMode(): Promise<OperationResult>;
  excludeFromAltTab(identity: WindowIdentity): Promise<OperationResult>;
  restoreWindowVisuals(identity: WindowIdentity): Promise<OperationResult>;
  forceRestore(): Promise<OperationResult>;
  getHotkeyStatus(): Promise<HotkeyStatus>;
  updateHotkey(accelerator: string): Promise<HotkeyStatus>;
  createCategory(name: string): Promise<AppState>;
  deleteCategory(id: string): Promise<AppState>;
  renameCategory(id: string, name: string): Promise<AppState>;
  addWindowToCategory(categoryId: string, identity: WindowIdentity): Promise<AppState>;
  removeWindowFromCategory(categoryId: string, identity: WindowIdentity): Promise<AppState>;
}


