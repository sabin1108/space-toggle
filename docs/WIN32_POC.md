# Win32 PoC Notes

The first wrapper uses `koffi`, not `ffi-napi`.

Implemented MVP calls:

- `EnumWindows`
- `IsWindow`
- `IsWindowVisible`
- `GetWindowTextW`
- `GetClassNameW`
- `GetWindowRect`
- `GetWindowThreadProcessId`
- `OpenProcess`
- `QueryFullProcessImageNameW`
- `ShowWindow`

Planned for Drop Zone recovery:

- `GetWindowLongPtrW`
- `SetWindowLongPtrW`
- `SetLayeredWindowAttributes`

Important constraints:

- HWND values are runtime-only and are never persisted.
- `WindowIdentity` is persisted instead.
- Every operation must check `IsWindow` first.
- Failed Win32 calls should be surfaced as recoverable operation results.

