import { Notification, globalShortcut } from 'electron';
import type { HotkeyStatus } from '../shared/types';
import type { WindowManager } from './window-manager';

const DEFAULT_ACCELERATOR = 'CommandOrControl+Alt+Space';

export class HotkeyController {
  private status: HotkeyStatus = {
    accelerator: DEFAULT_ACCELERATOR,
    registered: false
  };

  constructor(private readonly windowManager: WindowManager) {}

  register(): HotkeyStatus {
    const registered = globalShortcut.register(DEFAULT_ACCELERATOR, () => {
      const result = this.windowManager.toggleMode();
      if (!result.ok) {
        new Notification({
          title: 'SpaceToggle',
          body: result.message
        }).show();
      }
    });

    this.status = registered
      ? { accelerator: DEFAULT_ACCELERATOR, registered: true }
      : {
          accelerator: DEFAULT_ACCELERATOR,
          registered: false,
          error: 'Hotkey registration failed. Another app may already be using it.'
        };

    return this.status;
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.status = {
      ...this.status,
      registered: false
    };
  }

  getStatus(): HotkeyStatus {
    return { ...this.status };
  }
}

