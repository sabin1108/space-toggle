import { Notification, globalShortcut } from 'electron';
import type { HotkeyStatus } from '../shared/types';
import type { StateRepository } from './state';
import type { WindowManager } from './window-manager';

const DEFAULT_ACCELERATOR = 'CommandOrControl+Alt+Space';

export class HotkeyController {
  private status: HotkeyStatus = {
    accelerator: DEFAULT_ACCELERATOR,
    registered: false
  };

  constructor(
    private readonly windowManager: WindowManager,
    private readonly stateRepository: StateRepository
  ) {}

  register(customAccelerator?: string): HotkeyStatus {
    const accelerator = customAccelerator || DEFAULT_ACCELERATOR;
    globalShortcut.unregisterAll();

    const registered = globalShortcut.register(accelerator, () => {
      const result = this.windowManager.toggleMode();
      if (!result.ok) {
        new Notification({
          title: 'SpaceToggle',
          body: result.message
        }).show();
      }
    });

    this.status = registered
      ? { accelerator, registered: true }
      : {
          accelerator,
          registered: false,
          error: 'Hotkey registration failed. Another app may already be using it.'
        };

    return this.status;
  }

  update(nextAccelerator: string): HotkeyStatus {
    const previousAccelerator = this.status.accelerator;
    globalShortcut.unregisterAll();

    const registered = globalShortcut.register(nextAccelerator, () => {
      const result = this.windowManager.toggleMode();
      if (!result.ok) {
        new Notification({
          title: 'SpaceToggle',
          body: result.message
        }).show();
      }
    });

    if (registered) {
      this.status = { accelerator: nextAccelerator, registered: true };
      this.stateRepository.setCustomHotkey(nextAccelerator);
    } else {
      const rollbackRegistered = globalShortcut.register(previousAccelerator, () => {
        const result = this.windowManager.toggleMode();
        if (!result.ok) {
          new Notification({
            title: 'SpaceToggle',
            body: result.message
          }).show();
        }
      });

      if (rollbackRegistered) {
        this.status = {
          accelerator: previousAccelerator,
          registered: true,
          error: `Failed to register '${nextAccelerator}'. Rolled back to '${previousAccelerator}'.`
        };
        this.stateRepository.setCustomHotkey(previousAccelerator);
      } else {
        const defaultRegistered = globalShortcut.register(DEFAULT_ACCELERATOR, () => {
          const result = this.windowManager.toggleMode();
          if (!result.ok) {
            new Notification({
              title: 'SpaceToggle',
              body: result.message
            }).show();
          }
        });

        this.status = {
          accelerator: DEFAULT_ACCELERATOR,
          registered: defaultRegistered,
          error: `Failed to register '${nextAccelerator}'. Rolled back to default '${DEFAULT_ACCELERATOR}'.`
        };

        if (defaultRegistered) {
          this.stateRepository.setCustomHotkey(DEFAULT_ACCELERATOR);
        }
      }
    }

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

