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
  isTransparentMode: boolean;
  capturedWindows: WindowIdentity[];
}

export interface AppState {
  schemaVersion: number;
  currentMode: Mode;
  groups: {
    work: WindowIdentity[];
    play: WindowIdentity[];
  };
  dropZone: DropZoneState;
  lastCleanShutdown: boolean;
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
}
