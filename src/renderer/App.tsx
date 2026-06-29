import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle,
  Gamepad2,
  Info,
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
  WORK: '업무',
  PLAY: '여가',
  NEUTRAL: '기본'
};

const groupLabel: Record<GroupName, string> = {
  work: '업무 그룹',
  play: '여가 그룹'
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
  modifiedWindows: [],
  lastCleanShutdown: true
};

export const App = (): JSX.Element => {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (hash === '#dropzone') {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      document.body.style.minWidth = '0';
    }
  }, [hash]);

  if (hash === '#dropzone') {
    return <DropZoneOverlay />;
  }

  const [state, setState] = useState<AppState>(emptyState);
  const [windows, setWindows] = useState<WindowSnapshot[]>([]);
  const [hotkey, setHotkey] = useState<HotkeyStatus | null>(null);
  const [message, setMessage] = useState<string>('Ready');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');
  const [failures, setFailures] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [isEditingHotkey, setIsEditingHotkey] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addSelectedToGroup = async (group: GroupName): Promise<void> => {
    const targets = windows.filter((w) => selectedIds.has(w.id));
    if (targets.length === 0) return;

    try {
      let lastState = state;
      for (const item of targets) {
        lastState = await window.spaceToggle.addWindowToGroup(group, item.identity);
      }
      setState(lastState);
      setMessage(`${targets.length}개의 창이 ${groupLabel[group]}에 등록되었습니다.`);
      setMessageType('success');
      setFailures([]);
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    }
  };

  const startHotkeyEditing = (): void => {
    setRecordedKeys(hotkey?.accelerator || '');
    setIsEditingHotkey(true);
  };

  const cancelHotkeyEditing = (): void => {
    setIsEditingHotkey(false);
  };

  const handleHotkeyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];

    if (e.ctrlKey || e.metaKey) {
      parts.push('CommandOrControl');
    }
    if (e.altKey) {
      parts.push('Alt');
    }
    if (e.shiftKey) {
      parts.push('Shift');
    }

    const key = e.key;
    const isModifierOnly = ['Control', 'Alt', 'Shift', 'Meta'].includes(key);

    if (!isModifierOnly) {
      let keyName = key;
      if (keyName === ' ') {
        keyName = 'Space';
      } else if (keyName === '+') {
        keyName = 'Plus';
      } else if (keyName.length === 1) {
        keyName = keyName.toUpperCase();
      } else if (keyName.startsWith('Arrow')) {
        keyName = keyName.replace('Arrow', '');
      } else if (keyName === 'Escape') {
        keyName = 'Esc';
      }
      
      parts.push(keyName);
    }

    const combination = parts.join('+');
    setRecordedKeys(combination);
  };

  const saveHotkey = async (): Promise<void> => {
    if (!recordedKeys) {
      return;
    }
    try {
      const result = await window.spaceToggle.updateHotkey(recordedKeys);
      setHotkey(result);
      if (result.registered) {
        setMessage(`단축키가 ${result.accelerator}로 변경되었습니다.`);
        setMessageType('success');
        setFailures([]);
        setIsEditingHotkey(false);
      } else {
        setMessage(result.error || '단축키 업데이트에 실패했습니다.');
        setMessageType('error');
        setFailures([]);
        setIsEditingHotkey(false);
      }
    } catch (err) {
      setMessage(String(err));
      setMessageType('error');
      setFailures([]);
    }
  };

  const refresh = async (): Promise<void> => {
    const [nextState, nextWindows, nextHotkey] = await Promise.all([
      window.spaceToggle.getState(),
      window.spaceToggle.listWindows(),
      window.spaceToggle.getHotkeyStatus()
    ]);
    setState(nextState);
    setWindows(nextWindows);
    setHotkey(nextHotkey);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    refresh().catch((error) => {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    });
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
    if (result.ok) {
      setMessageType('success');
      setFailures([]);
    } else {
      setMessageType('error');
      setFailures(result.failures || []);
    }
    await refresh();
  };

  const setMode = (mode: Mode): void => {
    runOperation(window.spaceToggle.setMode(mode)).catch((error) => {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    });
  };

  const forceRestore = (): void => {
    runOperation(window.spaceToggle.forceRestore()).catch((error) => {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    });
  };



  const restoreWindowVisuals = (identity: WindowIdentity): void => {
    runOperation(window.spaceToggle.restoreWindowVisuals(identity)).catch((error) => {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    });
  };

  const addToGroup = async (group: GroupName, identity: WindowIdentity): Promise<void> => {
    try {
      const nextState = await window.spaceToggle.addWindowToGroup(group, identity);
      setState(nextState);
      setMessage(`${basename(identity.processPath)} 창이 ${groupLabel[group]}에 추가되었습니다.`);
      setMessageType('success');
      setFailures([]);
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    }
  };

  const removeFromGroup = async (group: GroupName, identity: WindowIdentity): Promise<void> => {
    try {
      const nextState = await window.spaceToggle.removeWindowFromGroup(group, identity);
      setState(nextState);
      setMessage(`${basename(identity.processPath)} 창이 ${groupLabel[group]}에서 제거되었습니다.`);
      setMessageType('success');
      setFailures([]);
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    }
  };

  const knownKeys = new Set([
    ...state.groups.work.map(identityKey),
    ...state.groups.play.map(identityKey)
  ]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">윈도우 데스크톱 유틸리티</p>
          <h1>SpaceToggle</h1>
        </div>
        <div className="status-strip">
          <span className={`mode-pill mode-${state.currentMode.toLocaleLowerCase()}`}>
            {modeLabel[state.currentMode]}
          </span>
          {isEditingHotkey ? (
            <div className="hotkey-container">
              <input
                className="hotkey-recorder-input"
                value={recordedKeys}
                readOnly
                placeholder="단축키 입력..."
                onKeyDown={handleHotkeyKeyDown}
              />
              <button className="hotkey-btn" onClick={saveHotkey}>저장</button>
              <button className="hotkey-btn danger" onClick={cancelHotkeyEditing}>취소</button>
            </div>
          ) : (
            <div className="hotkey-container">
              <span className={hotkey?.registered ? 'signal ok' : 'signal warn'}>
                {hotkey?.registered ? hotkey.accelerator : '단축키 미지정'}
              </span>
              <button className="hotkey-edit-btn" onClick={startHotkeyEditing}>
                수정
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="toolbar" aria-label="모드 제어">
        <button className="tool-button" onClick={() => setMode('WORK')} title="업무 모드로 전환">
          <BriefcaseBusiness size={18} />
          <span>업무</span>
        </button>
        <button className="tool-button" onClick={() => setMode('PLAY')} title="여가 모드로 전환">
          <Gamepad2 size={18} />
          <span>여가</span>
        </button>
        <button className="tool-button" onClick={() => setMode('NEUTRAL')} title="기본 모드로 전환 (전체 표시)">
          <MonitorUp size={18} />
          <span>기본</span>
        </button>
        <button className="tool-button danger" onClick={forceRestore} title="모든 창 원래 위치로 강제 복구">
          <RotateCcw size={18} />
          <span>복구</span>
        </button>
        <button className="icon-button" onClick={refresh} title="창 목록 새로고침">
          <RefreshCw size={18} />
        </button>
      </section>

      <section className={`message-line ${messageType}`} aria-live="polite">
        <div className="message-content">
          {messageType === 'success' && <CheckCircle size={16} />}
          {messageType === 'error' && <AlertCircle size={16} />}
          {messageType === 'info' && <Info size={16} />}
          <span>{message}</span>
        </div>
        {failures.length > 0 && (
          <details className="failures-details">
            <summary>상세 에러 내역 ({failures.length}개)</summary>
            <ul className="failures-list">
              {failures.map((fail, i) => (
                <li key={i}>{fail}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="workspace">
        <section className="panel window-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">실시간 실행 중인 창</p>
              <h2>열린 창 목록</h2>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색 필터"
              aria-label="창 필터링"
            />
          </div>
          <div className="window-list">
            {filteredWindows.map((item) => (
              <article className="window-row" key={item.id}>
                <input
                  type="checkbox"
                  className="window-checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                />
                <div className="window-thumbnail-container">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="window-thumbnail" />
                  ) : (
                    <div className="window-thumbnail-placeholder">썸네일 없음</div>
                  )}
                </div>
                <div className="window-main">
                  <strong>{item.title}</strong>
                  <span>{basename(item.processPath)}</span>
                  <small>{item.className ?? '클래스 이름 없음'}</small>
                </div>
                <div className="row-actions">
                  <button
                    onClick={() => addToGroup('work', item.identity)}
                    disabled={knownKeys.has(identityKey(item.identity))}
                  >
                    업무
                  </button>
                  <button
                    onClick={() => addToGroup('play', item.identity)}
                    disabled={knownKeys.has(identityKey(item.identity))}
                  >
                    여가
                  </button>
                  <button onClick={() => restoreWindowVisuals(item.identity)}>복구</button>
                </div>
              </article>
            ))}
            {filteredWindows.length === 0 && (
              <div className="empty-state">
                <ListRestart size={22} />
                <span>일치하는 창이 없습니다.</span>
              </div>
            )}
          </div>
          {selectedIds.size > 0 && (
            <div className="batch-action-bar">
              <span>{selectedIds.size}개 창 선택됨</span>
              <div className="batch-buttons">
                <button onClick={() => addSelectedToGroup('work')}>업무 등록</button>
                <button onClick={() => addSelectedToGroup('play')}>여가 등록</button>
                <button className="danger" onClick={() => setSelectedIds(new Set())}>선택 해제</button>
              </div>
            </div>
          )}
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
        <p className="eyebrow">저장된 창 식별 정보</p>
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
            <small>{item.className ?? '모든 클래스'}</small>
          </div>
          <button onClick={() => onRemove(item)}>삭제</button>
        </article>
      ))}
      {items.length === 0 && <p className="muted">등록된 창이 없습니다.</p>}
    </div>
  </div>
);

const DropZoneOverlay = (): JSX.Element => {
  const [state, setState] = useState<AppState>(emptyState);

  useEffect(() => {
    const refreshState = async () => {
      try {
        const nextState = await window.spaceToggle.getState();
        setState(nextState);
      } catch (err) {
        console.error(err);
      }
    };
    refreshState();
    const interval = setInterval(refreshState, 1000);
    return () => clearInterval(interval);
  }, []);

  const count = state.dropZone?.capturedWindows?.length || 0;

  return (
    <div className="dropzone-overlay">
      <div className="dropzone-border">
        <div className="dropzone-content">
          <MonitorUp size={32} className="dropzone-icon" />
          <h2>드롭존 (Drop Zone)</h2>
          <p className="dropzone-count">{count}개의 창 캡처됨</p>
        </div>
      </div>
    </div>
  );
};

