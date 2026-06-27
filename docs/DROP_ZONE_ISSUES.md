# SpaceToggle Drop Zone & Recovery Hardening Issues

This file lists the vertical slices (tracer-bullet issues) proposed to implement Phase 2 and Phase 3 features.

---

## [이슈 #9] Drop Zone Transparent Overlay Window (Visual Shell) - CLOSED

### What to build
Create a secondary, transparent, frameless, skip-taskbar `BrowserWindow` in the Electron main process. This window will represent the Drop Zone. It must use the primary display coordinates from `AppState.dropZone` (default `80, 80, 480, 270`). It must be styled with a dashed/colored border, and utilize Electron's click-through configuration so clicks pass to windows underneath. It must also synchronize with DPI or screen display metrics changes.

### Acceptance criteria
- [x] Secondary transparent, frameless window is spawned on application startup.
- [x] Click-through is active (users can click, scroll, and drag windows *behind* the Drop Zone visual frame).
- [x] Renders a visually distinct overlay (dashed border / semi-transparent area) indicating the Drop Zone region.
- [x] Repositions and rescales itself correctly upon display layout/scaling changes.

### Blocked by
None - can start immediately.

---

## [이슈 #10] Win32 Drag/Drop Detection & Rectangle Intersection - CLOSED

### What to build
Add native bindings for checking the active drag state of windows (such as checking `GetAsyncKeyState(VK_LBUTTON)` to detect when the mouse is released). Set up a polling timer (e.g., 250ms) in the main process. When a user stops dragging a window (mouse button released), obtain the foreground window's HWND and rect via `GetForegroundWindow` and `GetWindowRect`. Check if its bounding box intersects with the Drop Zone overlay.

### Acceptance criteria
- [x] Win32 service exposes `GetForegroundWindow` and mouse state checks.
- [x] Log or trigger an event in the main process when the foreground window's rectangle overlaps the Drop Zone region upon drag release.
- [x] Does not trigger detection for SpaceToggle's own windows.

### Blocked by
- [이슈 #9] Drop Zone Transparent Overlay Window (Visual Shell)

---

## [이슈 #11] Opacity Control & Chrome/Edge Fallback Mode - CLOSED

### What to build
When a window is detected as intersecting the Drop Zone, apply `WS_EX_LAYERED` style and `SetLayeredWindowAttributes` with 50% alpha (128) to the target window. For Chrome or Edge windows (identified by executable name), or as a configurable fallback, implement off-screen positioning `(-32000, -32000)` if layered transparency is unreliable. Add a "Captured Windows" list to the state and UI to show currently captured windows.

### Acceptance criteria
- [x] Dragging and dropping an eligible window into the Drop Zone applies 50% opacity.
- [x] Dragging and dropping Chrome/Edge falls back to off-screen movement if configured, hiding the window.
- [x] Captured windows are tracked in the state and can be restored to their original visual styling/position.

### Blocked by
- [이슈 #10] Win32 Drag/Drop Detection & Rectangle Intersection

---

## [이슈 #12] System Tray Restore & Crash Recovery Hardening - CLOSED

### What to build
Harden the app state storage: save the original styles (window styles, positions) of all modified windows immediately upon state changes. Add a "Force Restore All" action in the System Tray menu. On application startup, check `lastCleanShutdown` flag. If `false` (indicating a crash or Task Manager forced termination), iterate through all tracked/captured window records and restore their original visual states and positions.

### Acceptance criteria
- [x] Application state persists window metadata instantly.
- [x] Right-clicking the system tray icon and selecting "Force Restore All" restores all modified windows.
- [x] Killing the application via Task Manager leaves windows in their modified states, but launching SpaceToggle again automatically restores all modified windows to normal.

### Blocked by
- [이슈 #11] Opacity Control & Chrome/Edge Fallback Mode
