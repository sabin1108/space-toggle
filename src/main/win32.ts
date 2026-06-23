import koffi from 'koffi';
import type { OperationResult, WindowRect, WindowSnapshot } from '../shared/types';

type NativeHandle = unknown;

interface NativeWindowBinding {
  hwnd: NativeHandle;
  snapshot: WindowSnapshot;
}

interface RectStruct {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Win32Service {
  readonly isAvailable: boolean;
  listWindows(): NativeWindowBinding[];
  isWindow(hwnd: NativeHandle): boolean;
  showWindow(hwnd: NativeHandle): OperationResult;
  hideWindow(hwnd: NativeHandle): OperationResult;
  excludeFromAltTab(hwnd: NativeHandle): OperationResult;
  restoreWindowVisuals(hwnd: NativeHandle): OperationResult;
}

const SW_HIDE = 0;
const SW_SHOW = 5;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const GWL_EXSTYLE = -20;
const WS_EX_TOOLWINDOW = 0x00000080;
const WS_EX_APPWINDOW = 0x00040000;
const LWA_ALPHA = 0x00000002;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const GW_OWNER = 4;

const SYSTEM_PROCESS_BLACKLIST = [
  'textinputhost.exe',
  'searchhost.exe',
  'startmenuexperiencehost.exe',
  'shellexperiencehost.exe',
  'lockapp.exe',
  'systemsettings.exe',
  'peopleexperiencehost.exe'
];

const SYSTEM_CLASS_BLACKLIST = [
  'shell_traywnd',
  'dv2controlhost',
  'workerw',
  'progman',
  'notifyiconoverflowwindow'
];

const pointerObjectIds = new WeakMap<object, string>();
let pointerObjectCounter = 0;

const readUtf16 = (buffer: Buffer, charCount?: number): string => {
  const maxBytes = typeof charCount === 'number' ? Math.max(charCount, 0) * 2 : buffer.length;
  return buffer.subarray(0, maxBytes).toString('utf16le').replace(/\0+$/g, '');
};

const pointerId = (value: NativeHandle): string => {
  if (typeof value === 'bigint') {
    return `0x${value.toString(16)}`;
  }

  if (typeof value === 'number') {
    return `0x${value.toString(16)}`;
  }

  if (value && typeof value === 'object') {
    const existing = pointerObjectIds.get(value);
    if (existing) {
      return existing;
    }

    pointerObjectCounter += 1;
    const generated = `hwnd-${pointerObjectCounter}`;
    pointerObjectIds.set(value, generated);
    return generated;
  }

  return 'hwnd-unknown';
};

const numeric = (value: unknown): number => {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return value;
  }

  return Number(value ?? 0);
};

class DisabledWin32Service implements Win32Service {
  readonly isAvailable = false;

  listWindows(): NativeWindowBinding[] {
    return [];
  }

  isWindow(): boolean {
    return false;
  }

  showWindow(): OperationResult {
    return { ok: false, message: 'Win32 APIs are unavailable on this platform.' };
  }

  hideWindow(): OperationResult {
    return { ok: false, message: 'Win32 APIs are unavailable on this platform.' };
  }

  excludeFromAltTab(): OperationResult {
    return { ok: false, message: 'Win32 APIs are unavailable on this platform.' };
  }

  restoreWindowVisuals(): OperationResult {
    return { ok: false, message: 'Win32 APIs are unavailable on this platform.' };
  }
}

class KoffiWin32Service implements Win32Service {
  readonly isAvailable = true;

  private readonly user32 = koffi.load('user32.dll');
  private readonly kernel32 = koffi.load('kernel32.dll');

  private readonly RECT = koffi.struct('RECT', {
    left: 'long',
    top: 'long',
    right: 'long',
    bottom: 'long'
  });

  private readonly EnumWindowsProc = koffi.proto('__stdcall', 'EnumWindowsProc', 'bool', [
    'void *',
    'long'
  ]);

  private readonly EnumWindows = this.user32.func(
    'bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, long lParam)'
  );
  private readonly IsWindow = this.user32.func('bool __stdcall IsWindow(void *hWnd)');
  private readonly IsWindowVisible = this.user32.func('bool __stdcall IsWindowVisible(void *hWnd)');
  private readonly GetWindow = this.user32.func('void * __stdcall GetWindow(void *hWnd, uint32 uCmd)');
  private readonly GetWindowTextLengthW = this.user32.func(
    'int __stdcall GetWindowTextLengthW(void *hWnd)'
  );
  private readonly GetWindowTextW = this.user32.func(
    'int __stdcall GetWindowTextW(void *hWnd, void *lpString, int nMaxCount)'
  );
  private readonly GetClassNameW = this.user32.func(
    'int __stdcall GetClassNameW(void *hWnd, void *lpClassName, int nMaxCount)'
  );
  private readonly GetWindowRect = this.user32.func(
    'bool __stdcall GetWindowRect(void *hWnd, _Out_ RECT *lpRect)'
  );
  private readonly GetWindowThreadProcessId = this.user32.func(
    'uint32 __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *lpdwProcessId)'
  );
  private readonly ShowWindow = this.user32.func('bool __stdcall ShowWindow(void *hWnd, int nCmdShow)');
  private readonly GetWindowLongPtrW = this.user32.func(
    'intptr __stdcall GetWindowLongPtrW(void *hWnd, int nIndex)'
  );
  private readonly SetWindowLongPtrW = this.user32.func(
    'intptr __stdcall SetWindowLongPtrW(void *hWnd, int nIndex, intptr dwNewLong)'
  );
  private readonly SetWindowPos = this.user32.func(
    'bool __stdcall SetWindowPos(void *hWnd, void *hWndInsertAfter, int X, int Y, int cx, int cy, uint32 uFlags)'
  );
  private readonly SetLayeredWindowAttributes = this.user32.func(
    'bool __stdcall SetLayeredWindowAttributes(void *hWnd, uint32 crKey, uint8 bAlpha, uint32 dwFlags)'
  );
  private readonly OpenProcess = this.kernel32.func(
    'void * __stdcall OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)'
  );
  private readonly QueryFullProcessImageNameW = this.kernel32.func(
    'bool __stdcall QueryFullProcessImageNameW(void *hProcess, uint32 dwFlags, void *lpExeName, _Inout_ uint32 *lpdwSize)'
  );
  private readonly CloseHandle = this.kernel32.func('bool __stdcall CloseHandle(void *hObject)');

  listWindows(): NativeWindowBinding[] {
    const bindings: NativeWindowBinding[] = [];
    const callback = koffi.register((hwnd: NativeHandle) => {
      if (!this.isWindow(hwnd) || !this.isVisible(hwnd)) {
        return true;
      }

      // 1. Owner Window Filter
      const owner = this.GetWindow(hwnd, GW_OWNER);
      if (owner !== null) {
        return true;
      }

      // 2. Tool Window Style Filter
      const style = numeric(this.GetWindowLongPtrW(hwnd, GWL_EXSTYLE));
      if ((style & WS_EX_TOOLWINDOW) !== 0 && (style & WS_EX_APPWINDOW) === 0) {
        return true;
      }

      const title = this.getWindowTitle(hwnd);
      if (!title) {
        return true;
      }

      const processPath = this.getProcessPath(hwnd);
      if (!processPath) {
        return true;
      }

      // 3. Process Blacklist Filter
      const pathParts = processPath.split(/[\\/]/g);
      const processName = (pathParts[pathParts.length - 1] || '').toLowerCase();
      if (SYSTEM_PROCESS_BLACKLIST.includes(processName)) {
        return true;
      }

      const className = this.getClassName(hwnd);
      // 4. Class Blacklist Filter
      if (className) {
        const clsLower = className.toLowerCase();
        if (SYSTEM_CLASS_BLACKLIST.includes(clsLower)) {
          return true;
        }
      }

      const rect = this.getRect(hwnd);

      bindings.push({
        hwnd,
        snapshot: {
          id: pointerId(hwnd),
          title,
          processPath,
          className,
          rect,
          isVisible: true,
          identity: {
            processPath,
            titlePattern: title,
            className
          }
        }
      });

      return true;
    }, koffi.pointer(this.EnumWindowsProc));

    try {
      this.EnumWindows(callback, 0);
    } finally {
      koffi.unregister(callback);
    }

    return bindings;
  }

  isWindow(hwnd: NativeHandle): boolean {
    return Boolean(this.IsWindow(hwnd));
  }

  showWindow(hwnd: NativeHandle): OperationResult {
    return this.callShowWindow(hwnd, SW_SHOW, 'shown');
  }

  hideWindow(hwnd: NativeHandle): OperationResult {
    return this.callShowWindow(hwnd, SW_HIDE, 'hidden');
  }

  excludeFromAltTab(hwnd: NativeHandle): OperationResult {
    if (!this.isWindow(hwnd)) {
      return { ok: false, message: 'Window handle is no longer valid.' };
    }

    const style = numeric(this.GetWindowLongPtrW(hwnd, GWL_EXSTYLE));
    const nextStyle = (style | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
    this.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, nextStyle);
    const refreshed = this.refreshWindowFrame(hwnd);

    return {
      ok: refreshed,
      message: refreshed
        ? 'Window remains visible and is marked as excluded from Alt+Tab.'
        : 'Window style was changed, but frame refresh did not report success.'
    };
  }

  restoreWindowVisuals(hwnd: NativeHandle): OperationResult {
    if (!this.isWindow(hwnd)) {
      return { ok: false, message: 'Window handle is no longer valid.' };
    }

    const style = numeric(this.GetWindowLongPtrW(hwnd, GWL_EXSTYLE));
    if (style !== 0) {
      this.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (style & ~WS_EX_TOOLWINDOW) | WS_EX_APPWINDOW);
    }

    this.SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
    this.refreshWindowFrame(hwnd);
    const showResult = this.showWindow(hwnd);

    return {
      ok: showResult.ok,
      message: showResult.ok ? 'Window visuals restored.' : showResult.message
    };
  }

  private callShowWindow(hwnd: NativeHandle, command: number, verb: string): OperationResult {
    if (!this.isWindow(hwnd)) {
      return { ok: false, message: 'Window handle is no longer valid.' };
    }

    const ok = Boolean(this.ShowWindow(hwnd, command));
    return {
      ok,
      message: ok ? `Window ${verb}.` : `ShowWindow did not report success while ${verb}.`
    };
  }

  private refreshWindowFrame(hwnd: NativeHandle): boolean {
    return Boolean(
      this.SetWindowPos(
        hwnd,
        null,
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED
      )
    );
  }

  private isVisible(hwnd: NativeHandle): boolean {
    return Boolean(this.IsWindowVisible(hwnd));
  }

  private getWindowTitle(hwnd: NativeHandle): string {
    const length = Number(this.GetWindowTextLengthW(hwnd));
    if (length <= 0) {
      return '';
    }

    const buffer = Buffer.alloc((length + 1) * 2);
    const copied = Number(this.GetWindowTextW(hwnd, buffer, length + 1));
    return readUtf16(buffer, copied);
  }

  private getClassName(hwnd: NativeHandle): string | undefined {
    const maxChars = 256;
    const buffer = Buffer.alloc(maxChars * 2);
    const copied = Number(this.GetClassNameW(hwnd, buffer, maxChars));
    const className = readUtf16(buffer, copied);
    return className || undefined;
  }

  private getRect(hwnd: NativeHandle): WindowRect | null {
    const rect: RectStruct = { left: 0, top: 0, right: 0, bottom: 0 };
    const ok = Boolean(this.GetWindowRect(hwnd, rect));
    if (!ok) {
      return null;
    }

    return {
      x: rect.left,
      y: rect.top,
      width: Math.max(0, rect.right - rect.left),
      height: Math.max(0, rect.bottom - rect.top)
    };
  }

  private getProcessPath(hwnd: NativeHandle): string {
    const pidRef = [0];
    this.GetWindowThreadProcessId(hwnd, pidRef);
    const processId = pidRef[0];
    if (!processId) {
      return '';
    }

    const processHandle = this.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId);
    if (!processHandle) {
      return '';
    }

    try {
      const maxChars = 32768;
      const sizeRef = [maxChars];
      const buffer = Buffer.alloc(maxChars * 2);
      const ok = Boolean(this.QueryFullProcessImageNameW(processHandle, 0, buffer, sizeRef));
      return ok ? readUtf16(buffer, sizeRef[0]) : '';
    } finally {
      this.CloseHandle(processHandle);
    }
  }
}

export const createWin32Service = (): Win32Service => {
  if (process.platform !== 'win32') {
    return new DisabledWin32Service();
  }

  try {
    return new KoffiWin32Service();
  } catch (error) {
    console.error('Failed to initialize Win32 service:', error);
    return new DisabledWin32Service();
  }
};
