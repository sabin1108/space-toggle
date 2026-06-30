import type {
  AppState,
  GroupName,
  Mode,
  OperationResult,
  WindowIdentity,
  WindowSnapshot,
  ModifiedWindowRecord
} from '../shared/types';
import type { StateRepository } from './state';
import type { Win32Service } from './win32';

type NativeWindow = ReturnType<Win32Service['listWindows']>[number];

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

const identityKey = (identity: WindowIdentity): string =>
  [
    normalize(identity.processPath),
    normalize(identity.titlePattern),
    normalize(identity.className ?? '')
  ].join('|');

const basename = (value: string): string => {
  const parts = value.split(/[\\/]/g);
  return parts[parts.length - 1] || value;
};

const identityLabel = (identity: WindowIdentity): string =>
  `${basename(identity.processPath)} / ${identity.titlePattern}`;

const matchesIdentity = (snapshot: WindowSnapshot, identity: WindowIdentity): boolean => {
  const sameProcess = normalize(snapshot.processPath) === normalize(identity.processPath);
  if (!sameProcess) {
    return false;
  }

  if (identity.className && normalize(snapshot.className ?? '') !== normalize(identity.className)) {
    return false;
  }

  const titlePattern = normalize(identity.titlePattern);
  return !titlePattern || normalize(snapshot.title).includes(titlePattern);
};

const uniqueIdentities = (items: WindowIdentity[]): WindowIdentity[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [item.processPath, item.titlePattern, item.className ?? '']
      .map(normalize)
      .join('|');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export class WindowManager {
  private readonly activeWindows = new Map<string, NativeWindow>();
  private cachedWindows: NativeWindow[] = [];
  private lastFetchTime = 0;
  private readonly THROTTLE_MS = 500;

  private dragPollInterval: NodeJS.Timeout | null = null;
  private isDragging = false;

  constructor(
    private readonly state: StateRepository,
    private readonly win32: Win32Service
  ) {
    this.startDragPolling();
  }

  private startDragPolling(): void {
    if (!this.win32.isAvailable) {
      return;
    }
    this.dragPollInterval = setInterval(() => {
      try {
        const isDown = this.win32.isLButtonDown();
        if (isDown) {
          this.isDragging = true;
        } else if (this.isDragging) {
          this.isDragging = false;
          this.handleDragRelease();
        }
      } catch (err) {
        console.error('Error in drag polling:', err);
      }
    }, 250);
  }

  private handleDragRelease(): void {
    const hwnd = this.win32.getForegroundWindow();
    if (!hwnd || !this.win32.isWindow(hwnd)) {
      return;
    }
    if (this.win32.isOwnWindow(hwnd)) {
      return;
    }

    const rect = this.win32.getWindowRect(hwnd);
    if (!rect) {
      return;
    }

    const state = this.state.get();
    const dz = state.dropZone;

    if (this.intersects(rect, dz)) {
      this.captureWindowToDropZone(hwnd);
    }
  }

  private intersects(
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  private isChromeOrEdge(processPath: string): boolean {
    const normalized = processPath.toLowerCase();
    return normalized.endsWith('chrome.exe') || normalized.endsWith('msedge.exe');
  }

  private captureWindowToDropZone(hwnd: unknown): void {
    if (!this.win32.isWindow(hwnd)) {
      return;
    }

    const snapshot = this.win32.getWindowSnapshot(hwnd);
    if (!snapshot) {
      return;
    }

    const state = this.state.get();
    const dz = state.dropZone;

    const targetKey = [
      snapshot.processPath,
      snapshot.title,
      snapshot.className ?? ''
    ].map(normalize).join('|');

    const isAlreadyCaptured = dz.capturedWindows.some((w) => {
      return [
        w.processPath,
        w.titlePattern,
        w.className ?? ''
      ].map(normalize).join('|') === targetKey;
    });

    if (isAlreadyCaptured) {
      return;
    }

    const originalRect = this.win32.getWindowRect(hwnd);
    const originalExStyle = this.win32.getWindowExStyle(hwnd);

    this.state.addWindowToDropZone(snapshot.identity);

    const isBrowser = this.isChromeOrEdge(snapshot.processPath);
    const useOffscreen = !dz.isTransparentMode || isBrowser;
    const type = useOffscreen ? 'OFFSCREEN' : 'TRANSPARENT';

    this.state.addModifiedWindow({
      identity: snapshot.identity,
      originalRect,
      originalExStyle,
      type
    });

    if (type === 'TRANSPARENT') {
      this.win32.setWindowTransparency(hwnd, 128);
    } else {
      const width = originalRect ? originalRect.width : 800;
      const height = originalRect ? originalRect.height : 600;
      this.win32.setWindowRect(hwnd, { x: -32000, y: -32000, width, height });
      this.win32.excludeFromAltTab(hwnd);
    }

    console.log(`[DropZone] Successfully captured window "${snapshot.title}" as ${type}.`);
  }

  private pruneActiveWindows(): void {
    for (const [id, item] of this.activeWindows.entries()) {
      if (!this.win32.isWindow(item.hwnd)) {
        this.activeWindows.delete(id);
      }
    }
  }

  private invalidateCache(): void {
    this.lastFetchTime = 0;
  }

  async listWindows(force = false): Promise<WindowSnapshot[]> {
    const now = Date.now();
    let snapshots: WindowSnapshot[];

    if (!force && now - this.lastFetchTime < this.THROTTLE_MS && this.cachedWindows.length > 0) {
      snapshots = this.cachedWindows.map((binding) => binding.snapshot);
    } else {
      this.pruneActiveWindows();
      const windows = this.win32.listWindows();
      for (const item of windows) {
        this.activeWindows.set(item.snapshot.id, item);
      }
      this.cachedWindows = windows;
      this.lastFetchTime = now;
      snapshots = windows.map((binding) => binding.snapshot);
    }

    try {
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 400, height: 250 }
      });

      const thumbnailMap = new Map<string, string>();
      for (const src of sources) {
        const parts = src.id.split(':');
        if (parts[0] === 'window' && parts[1]) {
          const hwndDec = parseInt(parts[1], 10);
          if (!isNaN(hwndDec)) {
            const hexId = `0x${hwndDec.toString(16).toLowerCase()}`;
            thumbnailMap.set(hexId, src.thumbnail.toDataURL());
          }
        }
      }

      for (const snapshot of snapshots) {
        const idLower = snapshot.id.toLowerCase();
        if (thumbnailMap.has(idLower)) {
          snapshot.thumbnail = thumbnailMap.get(idLower);
        }
      }
    } catch (err) {
      console.error('Failed to capture thumbnails:', err);
    }

    return snapshots;
  }

  addToGroup(group: string, identity: WindowIdentity): AppState {
    this.invalidateCache();
    return this.state.addToGroup(group, identity);
  }

  removeFromGroup(group: string, identity: WindowIdentity): AppState {
    this.invalidateCache();
    return this.state.removeFromGroup(group, identity);
  }

  createCategory(name: string): AppState {
    return this.state.createCategory(name);
  }

  deleteCategory(id: string): AppState {
    this.invalidateCache();
    return this.state.deleteCategory(id);
  }

  renameCategory(id: string, name: string): AppState {
    return this.state.renameCategory(id, name);
  }

  addWindowToCategory(categoryId: string, identity: WindowIdentity): AppState {
    this.invalidateCache();
    return this.state.addWindowToCategory(categoryId, identity);
  }

  removeWindowFromCategory(categoryId: string, identity: WindowIdentity): AppState {
    this.invalidateCache();
    return this.state.removeWindowFromCategory(categoryId, identity);
  }

  toggleMode(): OperationResult {
    const state = this.state.get();
    const categories = state.categories;
    if (categories.length === 0) {
      return this.setMode('NEUTRAL');
    }

    const currentMode = state.currentMode;
    const currentIndex = categories.findIndex((c) => c.id.toLowerCase() === currentMode.toLowerCase());

    let nextMode: string;
    if (currentIndex === -1 || currentMode === 'NEUTRAL') {
      nextMode = categories[0].id;
    } else if (currentIndex === categories.length - 1) {
      nextMode = 'NEUTRAL';
    } else {
      nextMode = categories[currentIndex + 1].id;
    }

    return this.setMode(nextMode);
  }

  setMode(mode: string): OperationResult {
    this.invalidateCache();
    const canonicalMode = mode.toUpperCase() === 'NEUTRAL' ? 'NEUTRAL' : mode;
    const snapshot = this.state.setMode(canonicalMode);
    const windows = this.win32.listWindows();
    this.cachedWindows = windows;
    this.lastFetchTime = Date.now();
    for (const item of windows) {
      this.activeWindows.set(item.snapshot.id, item);
    }
    
    const failures: string[] = [];
    let changedCount = 0;

    const apply = (items: NativeWindow[], visible: boolean): void => {
      for (const item of items) {
        let result: OperationResult;
        if (visible) {
          result = this.win32.restoreWindowVisuals(item.hwnd);
        } else {
          const hideRes = this.win32.hideWindow(item.hwnd);
          const excludeRes = this.win32.excludeFromAltTab(item.hwnd);
          result = {
            ok: hideRes.ok && excludeRes.ok,
            message: `Hide: ${hideRes.message}, Exclude: ${excludeRes.message}`
          };
        }
        if (result.ok) {
          changedCount += 1;
        } else {
          failures.push(`${item.snapshot.title}: ${result.message}`);
        }
      }
    };

    if (canonicalMode === 'NEUTRAL') {
      const allIdentities = uniqueIdentities(
        snapshot.categories.flatMap((cat) => cat.windows)
      );
      const allNative = this.bindGroup(windows, allIdentities);
      apply(allNative, true);
    } else {
      const activeCat = snapshot.categories.find((c) => c.id.toLowerCase() === canonicalMode.toLowerCase());
      const activeIdentities = activeCat ? activeCat.windows : [];
      const activeNative = this.bindGroup(windows, activeIdentities);

      const inactiveCats = snapshot.categories.filter((c) => c.id.toLowerCase() !== (activeCat ? activeCat.id.toLowerCase() : ''));
      const activeKeys = new Set(activeIdentities.map(identityKey));
      
      const inactiveIdentities = uniqueIdentities(
        inactiveCats.flatMap((cat) => cat.windows)
      ).filter((id) => !activeKeys.has(identityKey(id)));
      
      const inactiveNative = this.bindGroup(windows, inactiveIdentities);

      apply(activeNative, true);
      apply(inactiveNative, false);
    }

    return {
      ok: failures.length === 0,
      message:
        failures.length === 0
          ? `Mode switched to ${mode}.`
          : `Mode switched to ${mode}, but ${failures.length} operation(s) failed.`,
      changedCount,
      failures
    };
  }

  excludeFromAltTab(identity: WindowIdentity): OperationResult {
    this.invalidateCache();
    const window = this.bindOne(identity);
    if (!window) {
      return {
        ok: false,
        message: `No current window match for ${identityLabel(identity)}.`
      };
    }

    return this.win32.excludeFromAltTab(window.hwnd);
  }

  restoreWindowVisuals(identity: WindowIdentity): OperationResult {
    this.invalidateCache();
    const window = this.bindOne(identity);

    const state = this.state.get();
    const key = (id: WindowIdentity) =>
      `${id.processPath.toLowerCase()}|${id.titlePattern.toLowerCase()}|${(id.className || '').toLowerCase()}`;
    const targetKey = key(identity);
    const record = state.modifiedWindows.find((r) => key(r.identity) === targetKey);

    if (record) {
      this.state.removeModifiedWindow(identity);
      this.state.removeWindowFromDropZone(identity);
    }

    if (!window) {
      return {
        ok: record !== undefined,
        message: record
          ? 'Window was removed from drop zone tracking, but live window not found.'
          : `No current window match for ${identityLabel(identity)}.`
      };
    }

    const res = this.win32.restoreWindowVisuals(window.hwnd);
    if (record && record.type === 'OFFSCREEN' && record.originalRect) {
      this.win32.setWindowRect(window.hwnd, record.originalRect);
    }

    return res;
  }

  forceRestore(): OperationResult {
    this.invalidateCache();
    const snapshot = this.state.setMode('NEUTRAL');

    const winList = this.win32.listWindows();
    this.cachedWindows = winList;
    this.lastFetchTime = Date.now();

    const failures: string[] = [];
    let changedCount = 0;

    // 1. 드롭존 변경 등 임시 스타일이 적용된 모든 윈도우 원래대로 복구
    for (const record of snapshot.modifiedWindows) {
      const window = this.bindOne(record.identity);
      if (window) {
        const res = this.win32.restoreWindowVisuals(window.hwnd);
        if (record.type === 'OFFSCREEN' && record.originalRect) {
          this.win32.setWindowRect(window.hwnd, record.originalRect);
        }
        if (res.ok) {
          changedCount += 1;
        } else {
          failures.push(`${window.snapshot.title}: ${res.message}`);
        }
      }
    }

    // 2. 관리 데이터 초기화 및 드롭존 영역 비우기
    this.state.clearModifiedWindows();
    const nextState = this.state.get();
    for (const dzWin of [...nextState.dropZone.capturedWindows]) {
      this.state.removeWindowFromDropZone(dzWin);
    }

    // 3. 각 카테고리에 저장되었던 모든 윈도우 스타일 복원 (전체 표시)
    const identities = uniqueIdentities(
      snapshot.categories.flatMap((cat) => cat.windows)
    );
    const windows = this.bindGroup(winList, identities);
    for (const window of windows) {
      const result = this.win32.restoreWindowVisuals(window.hwnd);
      if (result.ok) {
        changedCount += 1;
      } else {
        failures.push(`${window.snapshot.title}: ${result.message}`);
      }
    }

    return {
      ok: failures.length === 0,
      message:
        failures.length === 0
          ? `Restored ${changedCount} window(s).`
          : `Restore completed with ${failures.length} failure(s).`,
      changedCount,
      failures
    };
  }

  recoverAfterCrashIfNeeded(): OperationResult | null {
    const snapshot = this.state.get();
    if (snapshot.lastCleanShutdown) {
      return null;
    }

    return this.forceRestore();
  }

  private bindGroup(windows: NativeWindow[], identities: WindowIdentity[]): NativeWindow[] {
    const bound: NativeWindow[] = [];

    for (const identity of identities) {
      let match = windows.find((window) => matchesIdentity(window.snapshot, identity));
      if (!match) {
        for (const [id, item] of this.activeWindows.entries()) {
          if (this.win32.isWindow(item.hwnd)) {
            if (matchesIdentity(item.snapshot, identity)) {
              match = item;
              break;
            }
          } else {
            this.activeWindows.delete(id);
          }
        }
      }

      if (match) {
        bound.push(match);
      } else {
        console.warn(`No current HWND match for ${identityLabel(identity)}`);
      }
    }

    return bound;
  }

  private bindOne(identity: WindowIdentity): NativeWindow | undefined {
    const windows = this.win32.listWindows();
    for (const item of windows) {
      this.activeWindows.set(item.snapshot.id, item);
    }
    let match = windows.find((window) => matchesIdentity(window.snapshot, identity));
    if (!match) {
      for (const [id, item] of this.activeWindows.entries()) {
        if (this.win32.isWindow(item.hwnd)) {
          if (matchesIdentity(item.snapshot, identity)) {
            match = item;
            break;
          }
        } else {
          this.activeWindows.delete(id);
        }
      }
    }
    return match;
  }
}
