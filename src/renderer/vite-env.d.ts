/// <reference types="vite/client" />

import type { SpaceToggleApi } from '../shared/types';

declare global {
  interface Window {
    spaceToggle: SpaceToggleApi;
  }
}

