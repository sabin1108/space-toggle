export type Mode = 'WORK' | 'PLAY' | 'NEUTRAL';

export type GroupName = 'work' | 'play';

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
  groups: {
    work: WindowIdentity[];
    play: WindowIdentity[];
  };
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
  addWindowToGroup(group: GroupName, identity: WindowIdentity): Promise<AppState>;
  removeWindowFromGroup(group: GroupName, identity: WindowIdentity): Promise<AppState>;
  setMode(mode: Mode): Promise<OperationResult>;
  toggleMode(): Promise<OperationResult>;
  excludeFromAltTab(identity: WindowIdentity): Promise<OperationResult>;
  restoreWindowVisuals(identity: WindowIdentity): Promise<OperationResult>;
  forceRestore(): Promise<OperationResult>;
  getHotkeyStatus(): Promise<HotkeyStatus>;
  updateHotkey(accelerator: string): Promise<HotkeyStatus>;
}

