import {
  BriefcaseBusiness,
  Gamepad2,
  ListRestart,
  MonitorUp,
  RefreshCw,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  AppState,
  GroupName,
  HotkeyStatus,
  Mode,
  OperationResult,
  WindowIdentity,
  WindowSnapshot
} from '../shared/types';

const modeLabel: Record<Mode, string> = {
  WORK: 'Work',
  PLAY: 'Play',
  NEUTRAL: 'Neutral'
};

const groupLabel: Record<GroupName, string> = {
  work: 'Work',
  play: 'Play'
};

const basename = (value: string): string => {
  const parts = value.split(/[\\/]/g);
  return parts[parts.length - 1] || value;
};

const identityKey = (identity: WindowIdentity): string =>
  [identity.processPath, identity.titlePattern, identity.className ?? ''].join('|');

const emptyState: AppState = {
  schemaVersion: 1,
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

export const App = (): JSX.Element => {
  const [state, setState] = useState<AppState>(emptyState);
  const [windows, setWindows] = useState<WindowSnapshot[]>([]);
  const [hotkey, setHotkey] = useState<HotkeyStatus | null>(null);
  const [message, setMessage] = useState<string>('Ready');
  const [query, setQuery] = useState('');

  const refresh = async (): Promise<void> => {
    const [nextState, nextWindows, nextHotkey] = await Promise.all([
      window.spaceToggle.getState(),
      window.spaceToggle.listWindows(),
      window.spaceToggle.getHotkeyStatus()
    ]);
    setState(nextState);
    setWindows(nextWindows);
    setHotkey(nextHotkey);
  };

  useEffect(() => {
    refresh().catch((error) => setMessage(String(error)));
  }, []);

  const filteredWindows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) {
      return windows;
    }

    return windows.filter((item) =>
      [item.title, item.processPath, item.className ?? '']
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle)
    );
  }, [query, windows]);

  const runOperation = async (operation: Promise<OperationResult>): Promise<void> => {
    const result = await operation;
    setMessage(result.message);
    await refresh();
  };

  const setMode = (mode: Mode): void => {
    runOperation(window.spaceToggle.setMode(mode)).catch((error) => setMessage(String(error)));
  };

  const forceRestore = (): void => {
    runOperation(window.spaceToggle.forceRestore()).catch((error) => setMessage(String(error)));
  };

  const excludeFromAltTab = (identity: WindowIdentity): void => {
    runOperation(window.spaceToggle.excludeFromAltTab(identity)).catch((error) =>
      setMessage(String(error))
    );
  };

  const restoreWindowVisuals = (identity: WindowIdentity): void => {
    runOperation(window.spaceToggle.restoreWindowVisuals(identity)).catch((error) =>
      setMessage(String(error))
    );
  };

  const addToGroup = async (group: GroupName, identity: WindowIdentity): Promise<void> => {
    const nextState = await window.spaceToggle.addWindowToGroup(group, identity);
    setState(nextState);
    setMessage(`${basename(identity.processPath)} added to ${groupLabel[group]}.`);
  };

  const removeFromGroup = async (group: GroupName, identity: WindowIdentity): Promise<void> => {
    const nextState = await window.spaceToggle.removeWindowFromGroup(group, identity);
    setState(nextState);
    setMessage(`${basename(identity.processPath)} removed from ${groupLabel[group]}.`);
  };

  const knownKeys = new Set([
    ...state.groups.work.map(identityKey),
    ...state.groups.play.map(identityKey)
  ]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Windows desktop utility</p>
          <h1>SpaceToggle</h1>
        </div>
        <div className="status-strip">
          <span className={`mode-pill mode-${state.currentMode.toLocaleLowerCase()}`}>
            {modeLabel[state.currentMode]}
          </span>
          <span className={hotkey?.registered ? 'signal ok' : 'signal warn'}>
            {hotkey?.registered ? hotkey.accelerator : 'Hotkey unavailable'}
          </span>
        </div>
      </header>

      <section className="toolbar" aria-label="Mode controls">
        <button className="tool-button" onClick={() => setMode('WORK')} title="Switch to Work">
          <BriefcaseBusiness size={18} />
          <span>Work</span>
        </button>
        <button className="tool-button" onClick={() => setMode('PLAY')} title="Switch to Play">
          <Gamepad2 size={18} />
          <span>Play</span>
        </button>
        <button className="tool-button" onClick={() => setMode('NEUTRAL')} title="Show both groups">
          <MonitorUp size={18} />
          <span>Neutral</span>
        </button>
        <button className="tool-button danger" onClick={forceRestore} title="Force restore all windows">
          <RotateCcw size={18} />
          <span>Restore</span>
        </button>
        <button className="icon-button" onClick={refresh} title="Refresh windows">
          <RefreshCw size={18} />
        </button>
      </section>

      <section className="message-line" aria-live="polite">
        <ShieldAlert size={16} />
        <span>{message}</span>
      </section>

      <div className="workspace">
        <section className="panel window-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Live HWND bindings</p>
              <h2>Open Windows</h2>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter"
              aria-label="Filter windows"
            />
          </div>
          <div className="window-list">
            {filteredWindows.map((item) => (
              <article className="window-row" key={item.id}>
                <div className="window-main">
                  <strong>{item.title}</strong>
                  <span>{basename(item.processPath)}</span>
                  <small>{item.className ?? 'No class name'}</small>
                </div>
                <div className="row-actions">
                  <button
                    onClick={() => addToGroup('work', item.identity)}
                    disabled={knownKeys.has(identityKey(item.identity))}
                  >
                    Work
                  </button>
                  <button
                    onClick={() => addToGroup('play', item.identity)}
                    disabled={knownKeys.has(identityKey(item.identity))}
                  >
                    Play
                  </button>
                  <button onClick={() => excludeFromAltTab(item.identity)}>AltTab-</button>
                  <button onClick={() => restoreWindowVisuals(item.identity)}>Restore</button>
                </div>
              </article>
            ))}
            {filteredWindows.length === 0 && (
              <div className="empty-state">
                <ListRestart size={22} />
                <span>No matching windows found.</span>
              </div>
            )}
          </div>
        </section>

        <section className="panel group-grid">
          <GroupPanel
            group="work"
            items={state.groups.work}
            onRemove={(identity) => removeFromGroup('work', identity)}
          />
          <GroupPanel
            group="play"
            items={state.groups.play}
            onRemove={(identity) => removeFromGroup('play', identity)}
          />
        </section>
      </div>
    </main>
  );
};

interface GroupPanelProps {
  group: GroupName;
  items: WindowIdentity[];
  onRemove(identity: WindowIdentity): void;
}

const GroupPanel = ({ group, items, onRemove }: GroupPanelProps): JSX.Element => (
  <div className="group-column">
    <div className="panel-heading compact">
      <div>
        <p className="eyebrow">Saved identities</p>
        <h2>{groupLabel[group]}</h2>
      </div>
      <span className="count">{items.length}</span>
    </div>
    <div className="identity-list">
      {items.map((item) => (
        <article className="identity-row" key={identityKey(item)}>
          <div>
            <strong>{basename(item.processPath)}</strong>
            <span>{item.titlePattern}</span>
            <small>{item.className ?? 'Any class'}</small>
          </div>
          <button onClick={() => onRemove(item)}>Remove</button>
        </article>
      ))}
      {items.length === 0 && <p className="muted">No windows assigned.</p>}
    </div>
  </div>
);
