'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Vector3, type Group } from 'three';
import { Panel } from '../kit';

const head = new Vector3();
const dir = new Vector3();
const target = new Vector3();

/** A card that appears in front of where you look when it mounts (doors, Bousla, a classmate, an invite). */
export function FacingPanel({ width, height, children, distance = 1.15 }: { width: number; height: number; children: ReactNode; distance?: number }) {
  const camera = useThree((s) => s.camera);
  const g = useRef<Group>(null);
  useLayoutEffect(() => {
    const o = g.current;
    if (!o) return;
    camera.getWorldPosition(head);
    camera.getWorldDirection(dir);
    o.position.copy(head).addScaledVector(dir, distance);
    o.position.y -= 0.1;
    o.lookAt(head);
  }, [camera, distance]);
  return (
    <group ref={g}>
      <Panel width={width} height={height}>
        {children}
      </Panel>
    </group>
  );
}

/**
 * The belt menu: floats low in front of you and lazily follows when you turn (no head-locked UI, which feels bad in
 * VR). On a laptop it sits at the bottom of the view.
 */
export function Belt({ children, width = 1.0, height = 0.3 }: { children: ReactNode; width?: number; height?: number }) {
  const camera = useThree((s) => s.camera);
  const inVR = useXR((s) => s.mode === 'immersive-vr');
  const g = useRef<Group>(null);
  const placed = useRef(false);

  useFrame(() => {
    const o = g.current;
    if (!o) return;
    camera.getWorldPosition(head);
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const d = inVR ? 0.7 : 2.2;
    target.copy(head).addScaledVector(dir, d);
    target.y = head.y - (inVR ? 0.68 : 1.05);
    // follow only when it drifts out of view, then glide back
    if (!placed.current || o.position.distanceTo(target) > (inVR ? 0.45 : 0.05)) {
      o.position.lerp(target, placed.current ? 0.12 : 1);
      placed.current = true;
    }
    o.lookAt(head.x, o.position.y + (inVR ? 0.35 : 0.6), head.z);
  });

  return (
    <group ref={g} scale={inVR ? 1 : 1.5}>
      <Panel width={width} height={height} opacity={0.92}>
        {children}
      </Panel>
    </group>
  );
}
