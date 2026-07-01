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
  Category,
  HotkeyStatus,
  Mode,
  OperationResult,
  WindowIdentity,
  WindowSnapshot
} from '../shared/types';

const basename = (value: string): string => {
  const parts = value.split(/[\\/]/g);
  return parts[parts.length - 1] || value;
};

const identityKey = (identity: WindowIdentity): string =>
  [identity.processPath, identity.titlePattern, identity.className ?? ''].join('|');

const emptyState: AppState = {
  schemaVersion: 2,
  currentMode: 'NEUTRAL',
  categories: [],
  dropZone: {
    x: 80,
    y: 80,
    width: 480,
    height: 270,
    isTransparentMode: false,
    capturedWindows: [],
    opacity: 0.7,
    visible: true
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

  // 카테고리(그룹) 생성용 상태 변수
  const [newCatName, setNewCatName] = useState('');

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

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const nextState = await window.spaceToggle.createCategory(newCatName);
      setState(nextState);
      setMessage(`새 카테고리 "${newCatName}"가 생성되었습니다.`);
      setMessageType('success');
      setNewCatName('');
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`카테고리 "${name}"을 삭제하시겠습니까?`)) return;
    try {
      const nextState = await window.spaceToggle.deleteCategory(id);
      setState(nextState);
      setMessage(`카테고리 "${name}"이 삭제되었습니다.`);
      setMessageType('success');
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
    }
  };

  const saveRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const nextState = await window.spaceToggle.renameCategory(id, newName);
      setState(nextState);
      setMessage('카테고리 이름이 수정되었습니다.');
      setMessageType('success');
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
    }
  };

  const addSelectedToCategory = async (categoryId: string): Promise<void> => {
    const targets = windows.filter((w) => selectedIds.has(w.id));
    if (targets.length === 0) return;

    try {
      let lastState = state;
      for (const item of targets) {
        lastState = await window.spaceToggle.addWindowToCategory(categoryId, item.identity);
      }
      setState(lastState);
      const catName = lastState.categories.find(c => c.id === categoryId)?.name || categoryId;
      setMessage(`${targets.length}개의 창이 ${catName}에 등록되었습니다.`);
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

  const setMode = (mode: string): void => {
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

  const updateDropZoneConfig = async (
    config: Partial<Omit<AppState['dropZone'], 'capturedWindows'>>
  ): Promise<void> => {
    try {
      const nextState = await window.spaceToggle.updateDropZoneConfig(config);
      setState(nextState);
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    }
  };

  const addToCategory = async (categoryId: string, identity: WindowIdentity): Promise<void> => {
    try {
      const nextState = await window.spaceToggle.addWindowToCategory(categoryId, identity);
      setState(nextState);
      const catName = nextState.categories.find(c => c.id === categoryId)?.name || categoryId;
      setMessage(`${basename(identity.processPath)} 창이 ${catName}에 추가되었습니다.`);
      setMessageType('success');
      setFailures([]);
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    }
  };

  const removeFromCategory = async (categoryId: string, identity: WindowIdentity): Promise<void> => {
    try {
      const nextState = await window.spaceToggle.removeWindowFromCategory(categoryId, identity);
      setState(nextState);
      const catName = nextState.categories.find(c => c.id === categoryId)?.name || categoryId;
      setMessage(`${basename(identity.processPath)} 창이 ${catName}에서 제거되었습니다.`);
      setMessageType('success');
      setFailures([]);
    } catch (error) {
      setMessage(String(error));
      setMessageType('error');
      setFailures([]);
    }
  };

  const knownKeys = useMemo(() => {
    return new Set(
      state.categories.flatMap((cat) => cat.windows.map(identityKey))
    );
  }, [state.categories]);

  const activeModeName = useMemo(() => {
    if (state.currentMode === 'NEUTRAL') return '기본';
    const activeCat = state.categories.find((c) => c.id === state.currentMode);
    return activeCat ? activeCat.name : state.currentMode;
  }, [state.currentMode, state.categories]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">윈도우 데스크톱 유틸리티</p>
          <h1>SpaceToggle</h1>
        </div>
        <div className="status-strip">
          <span className={`mode-pill mode-${state.currentMode.toLocaleLowerCase()}`}>
            {activeModeName}
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
        {state.categories.map((cat) => (
          <button
            key={cat.id}
            className={`tool-button ${state.currentMode === cat.id ? 'active' : ''}`}
            onClick={() => setMode(cat.id)}
            title={`"${cat.name}" 모드로 전환`}
          >
            {cat.id === 'work' ? (
              <BriefcaseBusiness size={18} />
            ) : cat.id === 'play' ? (
              <Gamepad2 size={18} />
            ) : (
              <BriefcaseBusiness size={18} />
            )}
            <span>{cat.name}</span>
          </button>
        ))}
        <button
          className={`tool-button ${state.currentMode === 'NEUTRAL' ? 'active' : ''}`}
          onClick={() => setMode('NEUTRAL')}
          title="기본 모드로 전환 (전체 표시)"
        >
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
                  <select
                    className="category-add-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addToCategory(e.target.value, item.identity);
                      }
                    }}
                  >
                    <option value="">+ 카테고리 추가</option>
                    {state.categories.map((cat) => {
                      const alreadyIn = cat.windows.some((w) => identityKey(w) === identityKey(item.identity));
                      return (
                        <option key={cat.id} value={cat.id} disabled={alreadyIn}>
                          {cat.name}
                        </option>
                      );
                    })}
                  </select>
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
                <select
                  className="category-batch-select"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addSelectedToCategory(e.target.value);
                    }
                  }}
                >
                  <option value="">선택 항목 등록...</option>
                  {state.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button className="danger" onClick={() => setSelectedIds(new Set())}>선택 해제</button>
              </div>
            </div>
          )}
        </section>

        <section className="panel group-grid">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">그룹 분류 설정</p>
              <h2>카테고리 목록</h2>
            </div>
            <div className="create-category-container">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="새 카테고리명"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createCategory();
                }}
              />
              <button onClick={createCategory}>추가</button>
            </div>
          </div>
          <div className="categories-list">
            {state.categories.map((cat) => (
              <CategoryPanel
                key={cat.id}
                category={cat}
                onRemove={(identity) => removeFromCategory(cat.id, identity)}
                onDelete={() => deleteCategory(cat.id, cat.name)}
                onRename={(newName) => saveRename(cat.id, newName)}
              />
            ))}
            {state.categories.length === 0 && (
              <p className="muted">생성된 카테고리가 없습니다.</p>
            )}
          </div>
          <DropZoneSettingsPanel
            dropZone={state.dropZone}
            onUpdateConfig={updateDropZoneConfig}
          />
        </section>
      </div>
    </main>
  );
};

interface CategoryPanelProps {
  category: Category;
  onRemove(identity: WindowIdentity): void;
  onDelete(): void;
  onRename(newName: string): void;
}

const CategoryPanel = ({ category, onRemove, onDelete, onRename }: CategoryPanelProps): JSX.Element => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(category.name);

  const handleSave = () => {
    if (nameInput.trim() && nameInput.trim() !== category.name) {
      onRename(nameInput.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="group-column">
      <div className="panel-heading compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {isEditing ? (
            <input
              className="category-rename-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setNameInput(category.name);
                  setIsEditing(false);
                }
              }}
              autoFocus
            />
          ) : (
            <h2
              onDoubleClick={() => {
                setNameInput(category.name);
                setIsEditing(true);
              }}
              title="더블클릭하여 이름 수정"
              style={{ cursor: 'pointer' }}
            >
              {category.name}
            </h2>
          )}
          <button
            className="category-action-btn"
            onClick={() => {
              if (isEditing) {
                handleSave();
              } else {
                setNameInput(category.name);
                setIsEditing(true);
              }
            }}
          >
            {isEditing ? '저장' : '수정'}
          </button>
          <button className="category-action-btn danger" onClick={onDelete}>
            삭제
          </button>
        </div>
        <span className="count">{category.windows.length}</span>
      </div>
      <div className="identity-list">
        {category.windows.map((item) => (
          <article className="identity-row" key={identityKey(item)}>
            <div>
              <strong>{basename(item.processPath)}</strong>
              <span>{item.titlePattern}</span>
              <small>{item.className ?? '모든 클래스'}</small>
            </div>
            <button onClick={() => onRemove(item)}>삭제</button>
          </article>
        ))}
        {category.windows.length === 0 && <p className="muted">등록된 창이 없습니다.</p>}
      </div>
    </div>
  );
};

interface DropZoneSettingsPanelProps {
  dropZone: AppState['dropZone'];
  onUpdateConfig(config: Partial<Omit<AppState['dropZone'], 'capturedWindows'>>): void;
}

const DropZoneSettingsPanel = ({ dropZone, onUpdateConfig }: DropZoneSettingsPanelProps): JSX.Element => {
  const [opacityPercent, setOpacityPercent] = useState(Math.round((dropZone?.opacity ?? 0.7) * 100));

  useEffect(() => {
    if (dropZone?.opacity !== undefined) {
      setOpacityPercent(Math.round(dropZone.opacity * 100));
    }
  }, [dropZone?.opacity]);

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setOpacityPercent(value);
    onUpdateConfig({ opacity: value / 100 });
  };

  return (
    <div className="settings-panel">
      <div className="panel-heading compact" style={{ borderBottom: 'none', paddingBottom: '4px' }}>
        <div>
          <p className="eyebrow">오버레이 설정</p>
          <h2>드롭존 설정</h2>
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-item">
          <label htmlFor="dz-visibility">드롭존 화면 표시</label>
          <input
            id="dz-visibility"
            type="checkbox"
            checked={dropZone?.visible ?? true}
            onChange={(e) => onUpdateConfig({ visible: e.target.checked })}
          />
        </div>
        <div className="settings-item">
          <label htmlFor="dz-opacity">드롭존 투명도</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
            <input
              id="dz-opacity"
              type="range"
              min="10"
              max="100"
              value={opacityPercent}
              onChange={handleOpacityChange}
              disabled={!(dropZone?.visible ?? true)}
            />
            <span className="settings-value">{opacityPercent}%</span>
          </div>
        </div>
        <div className="settings-item">
          <label htmlFor="dz-transparent-mode">캡처된 창 투명화 적용</label>
          <input
            id="dz-transparent-mode"
            type="checkbox"
            checked={dropZone?.isTransparentMode ?? true}
            onChange={(e) => onUpdateConfig({ isTransparentMode: e.target.checked })}
          />
        </div>
      </div>
    </div>
  );
};

const DropZoneOverlay = (): JSX.Element => {
  const [state, setState] = useState<AppState>(emptyState);
  const [isResizing, setIsResizing] = useState(false);

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

  const startResize = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    window.spaceToggle.setIgnoreMouseEvents(false);

    const startX = e.screenX;
    const startY = e.screenY;
    const startBounds = {
      x: state.dropZone.x,
      y: state.dropZone.y,
      width: state.dropZone.width,
      height: state.dropZone.height
    };

    const handleMouseMove = async (moveEvent: MouseEvent) => {
      const dx = moveEvent.screenX - startX;
      const dy = moveEvent.screenY - startY;

      const newBounds = { ...startBounds };

      if (direction.includes('right')) {
        newBounds.width = Math.max(200, startBounds.width + dx);
      }
      if (direction.includes('left')) {
        const potentialWidth = startBounds.width - dx;
        if (potentialWidth >= 200) {
          newBounds.x = startBounds.x + dx;
          newBounds.width = potentialWidth;
        }
      }
      if (direction.includes('bottom')) {
        newBounds.height = Math.max(150, startBounds.height + dy);
      }
      if (direction.includes('top')) {
        const potentialHeight = startBounds.height - dy;
        if (potentialHeight >= 150) {
          newBounds.y = startBounds.y + dy;
          newBounds.height = potentialHeight;
        }
      }

      try {
        const updatedState = await window.spaceToggle.updateDropZoneConfig({
          x: newBounds.x,
          y: newBounds.y,
          width: newBounds.width,
          height: newBounds.height
        });
        setState(updatedState);
      } catch (err) {
        console.error('Failed to resize dropzone window:', err);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.spaceToggle.setIgnoreMouseEvents(true, { forward: true });
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseEnter = () => {
    window.spaceToggle.setIgnoreMouseEvents(false);
  };

  const handleMouseLeave = () => {
    if (!isResizing) {
      window.spaceToggle.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  return (
    <div className="dropzone-overlay">
      <div className="dropzone-border">
        <div className="dropzone-content">
          <MonitorUp size={32} className="dropzone-icon" />
          <h2>드롭존 (Drop Zone)</h2>
          <p className="dropzone-count">{count}개의 창 캡처됨</p>
        </div>
      </div>

      <div className="resize-handle top" onMouseDown={(e) => startResize(e, 'top')} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
      <div className="resize-handle bottom" onMouseDown={(e) => startResize(e, 'bottom')} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
      <div className="resize-handle left" onMouseDown={(e) => startResize(e, 'left')} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
      <div className="resize-handle right" onMouseDown={(e) => startResize(e, 'right')} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
      
      <div className="resize-handle top-left" onMouseDown={(e) => startResize(e, 'top-left')} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
      <div className="resize-handle top-right" onMouseDown={(e) => startResize(e, 'top-right')} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
      <div className="resize-handle bottom-left" onMouseDown={(e) => startResize(e, 'bottom-left')} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
      <div className="resize-handle bottom-right" onMouseDown={(e) => startResize(e, 'bottom-right')} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
    </div>
  );
};

