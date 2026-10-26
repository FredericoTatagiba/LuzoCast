import type { LuzoApi } from '../../shared/api';

declare global {
  interface Window {
    /** API exposta pelo preload (apps/host/src/preload/index.ts). */
    luzo: LuzoApi;
  }
}

export {};
