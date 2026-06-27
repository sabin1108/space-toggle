# SpaceToggle Drop Zone & Recovery Hardening PRD

## Problem Statement

Users want a visual, on-screen "Drop Zone" where they can drag active windows to capture them and apply transparency or hiding, separate from manual group registration. Currently, they have no visual UI area on the screen to drop windows, nor can they make windows semi-transparent. Furthermore, if the utility is force-closed (e.g., via Task Manager or a crash) while windows are hidden or transparent, those windows remain permanently modified or hidden, causing a bad user experience.

## Solution

1. **Transparent Frameless Overlay Window**: Create a transparent, click-through secondary window that serves as a visual Drop Zone.
2. **Intersection Detection**: Monitor window drag operations and detect when a window's bounds intersect the Drop Zone coordinates.
3. **Layered Transparency & Fallback**: Apply `WS_EX_LAYERED` transparency to captured windows, with a fallback off-screen movement strategy for Chrome/Edge if rendering is unreliable.
4. **Crash Recovery**: Save the states of all captured and modified windows immediately, and auto-restore them on startup if a clean shutdown did not occur. Expose a "Force Restore All" tray action.

## User Stories

1. As a user, I want to see a semi-transparent overlay "Drop Zone" on my screen, so that I know where to drag windows to capture them.
2. As a user, I want the Drop Zone to be frameless and click-through, so that it doesn't block my clicks to other windows underneath it.
3. As a user, I want the Drop Zone to automatically sync its position and size across DPI changes and display scaling, so that it remains correctly placed on the screen.
4. As a user, I want windows dragged and dropped inside the Drop Zone's rectangle to become semi-transparent (e.g., 50% opacity), so that I can see through them.
5. As a user, I want Chrome and Edge windows to also support transparency, or automatically fall back to being moved off-screen if transparent rendering fails, so that my browser windows are handled cleanly.
6. As a user, I want all captured windows to be saved in the application state, so that their status persists across sessions.
7. As a user, I want to be able to right-click the system tray icon and select "Force Restore All" to restore all hidden/transparent windows instantly.
8. As a user, if SpaceToggle is force-terminated via Task Manager, I want it to automatically restore all hidden, transparent, and Alt+Tab-excluded windows on its next startup, so that I don't lose access to my windows.

## Implementation Decisions

- **Drop Zone Window**:
  - The main process will spawn a secondary transparent, frameless `BrowserWindow`.
  - It will load `index.html#dropzone` or a dedicated lightweight page, showing a dashed border or overlay indicator.
  - Set `win.setIgnoreMouseEvents(true, { forward: true })` to enable click-through.
- **Intersection & Drag Monitoring**:
  - Poll the foreground window (`GetForegroundWindow` / `GetWindowRect`) at regular intervals (e.g., 250ms) in the main process when the mouse left button is pressed.
  - On mouse release, if the window rect intersects with the Drop Zone bounds, trigger the capture logic.
- **Window Transparency**:
  - Use Win32 `SetWindowLongPtrW` with `WS_EX_LAYERED` and `SetLayeredWindowAttributes` to adjust opacity.
  - If a window belongs to Chrome/Edge or is marked for fallback, use `SetWindowPos` to move it to `(-32000, -32000)` instead.
- **State Persistence & Recovery**:
  - Save window HWNDs and original styles/positions to state immediately before modifying them.
  - On startup, if `lastCleanShutdown` was false, iterate through captured/modified windows and restore them.

## Testing Decisions

- **Automated Tests**:
  - Assert the rectangle intersection detection logic using unit tests.
  - Verify that window visibility and transparency styles can be applied.
- **Manual Verification**:
  - Verify visually that the Drop Zone overlay window renders correctly.
  - Drag various apps (Notepad, Chrome, Explorer) into the zone and check transparency.
  - Terminate the process via Task Manager and verify auto-restore on relaunch.

## Out of Scope

- Multi-monitor Drop Zones (only primary monitor supported).
- Custom opacity levels per window.

## Further Notes

- Chrome and Edge require hardware acceleration compatibility checks. The off-screen fallback ensures robust behavior.
