import Store from 'electron-store';
import type { AppState, GroupName, Mode, WindowIdentity } from '../shared/types';

const SCHEMA_VERSION = 1;

const defaultState: AppState = {
  schemaVersion: SCHEMA_VERSION,
  currentMode: 'NEUTRAL',
  groups: {
    work: [],
    play: []
  },
  dropZone: {
    x: 80,
    y: 80,
    width: 480,
    height: 270,
    isTransparentMode: false,
    capturedWindows: []
  },
  lastCleanShutdown: true
};

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

const identityKey = (identity: WindowIdentity): string =>
  [
    normalize(identity.processPath),
    normalize(identity.titlePattern),
    normalize(identity.className ?? '')
  ].join('|');

export class StateRepository {
  private readonly store = new Store<AppState>({
    name: 'spacetoggle-state',
    defaults: defaultState
  });

  get(): AppState {
    return structuredClone(this.store.store);
  }

  replace(next: AppState): AppState {
    this.store.store = structuredClone(next);
    return this.get();
  }

  markSessionStarted(): void {
    const next = this.get();
    next.lastCleanShutdown = false;
    this.replace(next);
  }

  markCleanShutdown(): void {
    const next = this.get();
    next.lastCleanShutdown = true;
    this.replace(next);
  }

  setMode(mode: Mode): AppState {
    const next = this.get();
    next.currentMode = mode;
    return this.replace(next);
  }

  addToGroup(group: GroupName, identity: WindowIdentity): AppState {
    const next = this.get();
    const existingKeys = new Set(next.groups[group].map(identityKey));
    const normalized: WindowIdentity = {
      processPath: identity.processPath.trim(),
      titlePattern: identity.titlePattern.trim(),
      className: identity.className?.trim() || undefined
    };

    if (!existingKeys.has(identityKey(normalized))) {
      next.groups[group].push(normalized);
    }

    return this.replace(next);
  }

  removeFromGroup(group: GroupName, identity: WindowIdentity): AppState {
    const next = this.get();
    const targetKey = identityKey(identity);
    next.groups[group] = next.groups[group].filter((item) => identityKey(item) !== targetKey);
    return this.replace(next);
  }

  setCustomHotkey(hotkey: string): AppState {
    const next = this.get();
    next.customHotkey = hotkey;
    return this.replace(next);
  }
}

