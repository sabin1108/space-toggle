import type {
  AppState,
  GroupName,
  Mode,
  OperationResult,
  WindowIdentity,
  WindowSnapshot
} from '../shared/types';
import type { StateRepository } from './state';
import type { Win32Service } from './win32';

type NativeWindow = ReturnType<Win32Service['listWindows']>[number];

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

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

  constructor(
    private readonly state: StateRepository,
    private readonly win32: Win32Service
  ) {}

  listWindows(): WindowSnapshot[] {
    const windows = this.win32.listWindows();
    for (const item of windows) {
      this.activeWindows.set(item.snapshot.id, item);
    }
    return windows.map((binding) => binding.snapshot);
  }

  addToGroup(group: GroupName, identity: WindowIdentity): AppState {
    return this.state.addToGroup(group, identity);
  }

  removeFromGroup(group: GroupName, identity: WindowIdentity): AppState {
    return this.state.removeFromGroup(group, identity);
  }

  toggleMode(): OperationResult {
    const currentMode = this.state.get().currentMode;
    const nextMode: Mode = currentMode === 'WORK' ? 'PLAY' : 'WORK';
    return this.setMode(nextMode);
  }

  setMode(mode: Mode): OperationResult {
    const snapshot = this.state.setMode(mode);
    const windows = this.win32.listWindows();
    for (const item of windows) {
      this.activeWindows.set(item.snapshot.id, item);
    }
    const work = this.bindGroup(windows, snapshot.groups.work);
    const play = this.bindGroup(windows, snapshot.groups.play);
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

    if (mode === 'WORK') {
      apply(work, true);
      apply(play, false);
    } else if (mode === 'PLAY') {
      apply(work, false);
      apply(play, true);
    } else {
      apply(work, true);
      apply(play, true);
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
    const window = this.bindOne(identity);
    if (!window) {
      return {
        ok: false,
        message: `No current window match for ${identityLabel(identity)}.`
      };
    }

    return this.win32.restoreWindowVisuals(window.hwnd);
  }

  forceRestore(): OperationResult {
    const snapshot = this.state.setMode('NEUTRAL');
    const identities = uniqueIdentities([
      ...snapshot.groups.work,
      ...snapshot.groups.play,
      ...snapshot.dropZone.capturedWindows
    ]);
    const windows = this.bindGroup(this.win32.listWindows(), identities);
    const failures: string[] = [];
    let changedCount = 0;

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
        for (const item of this.activeWindows.values()) {
          if (this.win32.isWindow(item.hwnd) && matchesIdentity(item.snapshot, identity)) {
            match = item;
            break;
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
      for (const item of this.activeWindows.values()) {
        if (this.win32.isWindow(item.hwnd) && matchesIdentity(item.snapshot, identity)) {
          match = item;
          break;
        }
      }
    }
    return match;
  }
}
