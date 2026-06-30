import Store from 'electron-store';
import type { AppState, Category, Mode, WindowIdentity, ModifiedWindowRecord } from '../shared/types';

const SCHEMA_VERSION = 2;

const defaultState: AppState = {
  schemaVersion: SCHEMA_VERSION,
  currentMode: 'NEUTRAL',
  categories: [
    { id: 'work', name: '(메인)', windows: [] },
    { id: 'play', name: '(보조)', windows: [] }
  ],
  dropZone: {
    x: 80,
    y: 80,
    width: 480,
    height: 270,
    isTransparentMode: true, // 투명도 기반의 오버레이 창 활성화 상태 여부
    capturedWindows: []
  },
  modifiedWindows: [],
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

  constructor() {
    const raw = this.store.store as any;
    if (raw && (!raw.schemaVersion || raw.schemaVersion < 2)) {
      this.migrateSchema(raw);
    }
  }

  private migrateSchema(raw: any): void {
    console.log(`Migrating schema from ${raw.schemaVersion || 1} to 2...`);
    const migrated = { ...raw };
    migrated.schemaVersion = SCHEMA_VERSION;
    if (raw.groups) {
      migrated.categories = [
        { id: 'work', name: '(메인)', windows: raw.groups.work || [] },
        { id: 'play', name: '(보조)', windows: raw.groups.play || [] }
      ];
      delete migrated.groups;
    } else {
      migrated.categories = [
        { id: 'work', name: '(메인)', windows: [] },
        { id: 'play', name: '(보조)', windows: [] }
      ];
    }
    this.store.store = migrated;
  }

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

  createCategory(name: string): AppState {
    const next = this.get();
    const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    next.categories.push({
      id,
      name: name.trim(),
      windows: []
    });
    return this.replace(next);
  }

  deleteCategory(id: string): AppState {
    const next = this.get();
    next.categories = next.categories.filter((cat) => cat.id !== id);
    if (next.currentMode === id) {
      next.currentMode = 'NEUTRAL';
    }
    return this.replace(next);
  }

  renameCategory(id: string, name: string): AppState {
    const next = this.get();
    const cat = next.categories.find((c) => c.id === id);
    if (cat) {
      cat.name = name.trim();
    }
    return this.replace(next);
  }

  addWindowToCategory(categoryId: string, identity: WindowIdentity): AppState {
    const next = this.get();
    const cat = next.categories.find((c) => c.id === categoryId);
    if (cat) {
      const existingKeys = new Set(cat.windows.map(identityKey));
      const normalized: WindowIdentity = {
        processPath: identity.processPath.trim(),
        titlePattern: identity.titlePattern.trim(),
        className: identity.className?.trim() || undefined
      };

      if (!existingKeys.has(identityKey(normalized))) {
        cat.windows.push(normalized);
      }
    }
    return this.replace(next);
  }

  removeWindowFromCategory(categoryId: string, identity: WindowIdentity): AppState {
    const next = this.get();
    const cat = next.categories.find((c) => c.id === categoryId);
    if (cat) {
      const targetKey = identityKey(identity);
      cat.windows = cat.windows.filter((item) => identityKey(item) !== targetKey);
    }
    return this.replace(next);
  }

  addToGroup(group: string, identity: WindowIdentity): AppState {
    return this.addWindowToCategory(group, identity);
  }

  removeFromGroup(group: string, identity: WindowIdentity): AppState {
    return this.removeWindowFromCategory(group, identity);
  }

  setCustomHotkey(hotkey: string): AppState {
    const next = this.get();
    next.customHotkey = hotkey;
    return this.replace(next);
  }

  addModifiedWindow(record: ModifiedWindowRecord): AppState {
    const next = this.get();
    const targetKey = identityKey(record.identity);
    next.modifiedWindows = next.modifiedWindows.filter((r) => identityKey(r.identity) !== targetKey);
    next.modifiedWindows.push(record);
    return this.replace(next);
  }

  removeModifiedWindow(identity: WindowIdentity): AppState {
    const next = this.get();
    const targetKey = identityKey(identity);
    next.modifiedWindows = next.modifiedWindows.filter((r) => identityKey(r.identity) !== targetKey);
    return this.replace(next);
  }

  clearModifiedWindows(): AppState {
    const next = this.get();
    next.modifiedWindows = [];
    return this.replace(next);
  }

  addWindowToDropZone(identity: WindowIdentity): AppState {
    const next = this.get();
    const targetKey = identityKey(identity);
    if (!next.dropZone.capturedWindows.some((w) => identityKey(w) === targetKey)) {
      next.dropZone.capturedWindows.push(identity);
    }
    return this.replace(next);
  }

  removeWindowFromDropZone(identity: WindowIdentity): AppState {
    const next = this.get();
    const targetKey = identityKey(identity);
    next.dropZone.capturedWindows = next.dropZone.capturedWindows.filter((w) => identityKey(w) !== targetKey);
    return this.replace(next);
  }
}


