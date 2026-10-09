'use client';

/**
 * `window.__tajribaVR` — a small handle for Playwright (dev/e2e builds only), so tests can drive VR scenes without
 * aiming emulated controller rays at pixels. Scenes register their actions while they are mounted.
 */
export interface VRTestApi {
  /** 'immersive-vr' while a (real or emulated) XR session runs */
  session: string;
  scene: string;
  /** scene-specific progress, e.g. the Shadow Lab step */
  step: number;
  enterVR(): Promise<void>;
  setScene(scene: string): void;
  [action: string]: unknown;
}

const api: Partial<VRTestApi> = { session: 'none', scene: 'hub', step: 0 };

export function vrTest(patch: Partial<VRTestApi>) {
  Object.assign(api, patch);
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    (window as unknown as { __tajribaVR?: Partial<VRTestApi> }).__tajribaVR = api;
  }
}

/** Removes scene actions when a scene unmounts (keeps the shared fields). */
export function vrTestClear(keys: string[]) {
  for (const k of keys) delete api[k];
}
