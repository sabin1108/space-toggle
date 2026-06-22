# SpaceToggle Development Plan

## Phase 1: Work/Play MVP

1. Electron + React + TypeScript scaffold
2. secure BrowserWindow defaults
3. `koffi` Win32 wrapper PoC
4. current top-level window enumeration
5. identity-based group persistence
6. `Ctrl+Alt+Space` mode switching
7. tray force restore
8. stale handle and access-denied handling

## Phase 2: Drop Zone PoC

1. transparent frameless overlay window
2. display and DPI scale synchronization
3. rectangle intersection detection
4. independent transparency PoC for Chrome and Edge
5. fallback off-screen move strategy when layered transparency is unreliable

## Phase 3: Recovery Hardening

1. persist captured window identities immediately after state changes
2. auto-restore when `lastCleanShutdown` is false
3. expose permanent tray restore action
4. test forced termination through Task Manager

## Phase 4: Packaging

1. `electron-builder` NSIS package
2. `asInvoker` execution level
3. code signing review before distribution
4. Windows Defender and SmartScreen test pass

