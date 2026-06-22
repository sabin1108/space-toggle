const koffi = require('koffi');

if (process.platform !== 'win32') {
  console.log('Win32 verification skipped: not running on Windows.');
  process.exit(0);
}

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

const RECT = koffi.struct('RECT', {
  left: 'long',
  top: 'long',
  right: 'long',
  bottom: 'long'
});

const EnumWindowsProc = koffi.proto('__stdcall', 'EnumWindowsProc', 'bool', ['void *', 'long']);
const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, long lParam)');
const IsWindow = user32.func('bool __stdcall IsWindow(void *hWnd)');
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(void *hWnd)');
const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(void *hWnd)');
const GetWindowTextW = user32.func(
  'int __stdcall GetWindowTextW(void *hWnd, void *lpString, int nMaxCount)'
);
const GetClassNameW = user32.func(
  'int __stdcall GetClassNameW(void *hWnd, void *lpClassName, int nMaxCount)'
);
const GetWindowRect = user32.func('bool __stdcall GetWindowRect(void *hWnd, _Out_ RECT *lpRect)');
const GetWindowThreadProcessId = user32.func(
  'uint32 __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *lpdwProcessId)'
);
const OpenProcess = kernel32.func(
  'void * __stdcall OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)'
);
const QueryFullProcessImageNameW = kernel32.func(
  'bool __stdcall QueryFullProcessImageNameW(void *hProcess, uint32 dwFlags, void *lpExeName, _Inout_ uint32 *lpdwSize)'
);
const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void *hObject)');

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

const readUtf16 = (buffer, charCount) => {
  const maxBytes = Math.max(charCount ?? buffer.length / 2, 0) * 2;
  return buffer.subarray(0, maxBytes).toString('utf16le').replace(/\0+$/g, '');
};

const getProcessPath = (hwnd) => {
  const pidRef = [0];
  GetWindowThreadProcessId(hwnd, pidRef);
  if (!pidRef[0]) return '';

  const processHandle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pidRef[0]);
  if (!processHandle) return '';

  try {
    const maxChars = 32768;
    const sizeRef = [maxChars];
    const buffer = Buffer.alloc(maxChars * 2);
    return QueryFullProcessImageNameW(processHandle, 0, buffer, sizeRef)
      ? readUtf16(buffer, sizeRef[0])
      : '';
  } finally {
    CloseHandle(processHandle);
  }
};

const windows = [];
const callback = koffi.register((hwnd) => {
  if (!IsWindow(hwnd) || !IsWindowVisible(hwnd)) return true;

  const titleLength = GetWindowTextLengthW(hwnd);
  if (titleLength <= 0) return true;

  const titleBuffer = Buffer.alloc((titleLength + 1) * 2);
  const copiedTitle = GetWindowTextW(hwnd, titleBuffer, titleLength + 1);
  const classBuffer = Buffer.alloc(256 * 2);
  const copiedClass = GetClassNameW(hwnd, classBuffer, 256);
  const rect = { left: 0, top: 0, right: 0, bottom: 0 };
  const rectOk = GetWindowRect(hwnd, rect);

  windows.push({
    title: readUtf16(titleBuffer, copiedTitle),
    className: readUtf16(classBuffer, copiedClass),
    rect: rectOk
      ? {
          x: rect.left,
          y: rect.top,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top
        }
      : null,
    processPath: getProcessPath(hwnd)
  });

  return windows.length < 5;
}, koffi.pointer(EnumWindowsProc));

try {
  EnumWindows(callback, 0);
} finally {
  koffi.unregister(callback);
}

console.log(JSON.stringify({ count: windows.length, windows }, null, 2));
