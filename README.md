# SpaceToggle

SpaceToggle은 Windows 전용 Electron + React + TypeScript 데스크톱 유틸리티 초안입니다.
MVP는 전역 단축키로 Work/Play 창 그룹을 교차 숨김 전환하는 데 집중합니다.

## MVP 범위

- Work/Play/Neutral 모드 전환
- 현재 떠 있는 일반 창 열람
- 창 식별자(`processPath`, `titlePattern`, `className`) 기반 그룹 저장
- 전환 직전 `EnumWindows`로 HWND 재바인딩
- 모든 조작 전 `IsWindow` 유효성 검사
- 트레이 메뉴의 "Force restore all windows" 안전장치

Drop Zone, 투명화, Alt+Tab 제외 처리는 `docs/DEVELOPMENT_PLAN.md`에 2단계로 분리했습니다.

## 실행

```powershell
npm install
npm run dev
```

Windows가 아닌 환경에서는 Win32 wrapper가 비활성화되고 UI만 확인할 수 있습니다.

## 단축키

- 기본 전환 단축키: `Ctrl+Alt+Space`
- 등록 실패 시 UI와 트레이 알림에 실패 상태가 표시됩니다.

## 보안 기본값

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- preload에서 화이트리스트된 IPC 함수만 노출
- Renderer는 Win32 API를 직접 호출하지 않음
- Renderer가 임의 HWND를 보내는 구조를 피하고, Main이 현재 열거한 창 식별자를 기준으로만 동작

## 주의

관리자 권한으로 실행 중인 창은 일반 권한 앱에서 제어되지 않을 수 있습니다. 이는 Windows UIPI 정책에 따른 정상 동작입니다.

