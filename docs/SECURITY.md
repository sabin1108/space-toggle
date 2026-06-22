# Security Notes

SpaceToggle controls windows owned by other processes, so renderer-to-main trust boundaries matter.

## Renderer

- No Node integration
- No direct Win32 access
- No raw `ipcRenderer` exposure
- zod-validated payloads only

## Main

- Owns all Win32 calls
- Rebinds persisted identities to current HWNDs at runtime
- Avoids persisting HWNDs
- Keeps a permanent force-restore path in the tray menu

## Known Windows Limits

- UIPI can block control of elevated windows.
- Foreground focus changes can fail because of Windows focus-stealing prevention.
- Chromium layered-window transparency needs a real PoC before productizing.

