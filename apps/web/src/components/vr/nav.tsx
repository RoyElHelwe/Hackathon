'use client';

import { createContext, useContext } from 'react';

/** The VR experiences. All of them live in ONE page: switching never ends the headset's XR session. */
export type VRScene =
  | { kind: 'hub' }
  | { kind: 'shadow-lab'; missionId?: string }
  | { kind: 'campus' }
  | { kind: 'study'; id: string }
  | { kind: 'exam'; id: string };

/** `?scene=shadow-lab|campus|study:<id>|exam:<attemptId>` (+ `&mission=<id>` for the lab) → scene. */
export function parseScene(scene: string | null, mission?: string | null): VRScene {
  if (scene === 'shadow-lab') return { kind: 'shadow-lab', missionId: mission ?? undefined };
  if (scene === 'campus') return { kind: 'campus' };
  const m = /^(study|exam):([A-Za-z0-9_-]{1,64})$/.exec(scene ?? '');
  if (m) return { kind: m[1] as 'study' | 'exam', id: m[2] };
  return { kind: 'hub' };
}

export function sceneParam(s: VRScene): string {
  if (s.kind === 'study' || s.kind === 'exam') return `${s.kind}:${s.id}`;
  return s.kind;
}

export interface VRNav {
  scene: VRScene;
  go(scene: VRScene): void;
}

export const VRNavCtx = createContext<VRNav>({ scene: { kind: 'hub' }, go: () => undefined });
export const useVRNav = () => useContext(VRNavCtx);
