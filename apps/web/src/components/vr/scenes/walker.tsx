'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useXR, useXRControllerLocomotion } from '@react-three/xr';
import { METERS_PER_PX, slide, toMap, toWorld, type CampusMap, type PlayerState } from '@tajriba/shared';
import { useCallback, useEffect, useRef } from 'react';
import { Vector3, type Group } from 'three';
import type { useRoom } from '@/lib/campus/use-room';
import { VC } from '../kit';
import { useDesktopView } from '../stage';

type Room = ReturnType<typeof useRoom>;
type Dir = PlayerState['dir'];
const M = METERS_PER_PX;
const SEND_EVERY_MS = 60;
const DESKTOP_SPEED_PX = 150; // ~3.75 m/s, like the 2D campus

const head = new Vector3();
const look = new Vector3();

/** Keys held down (WASD / arrows), ignoring typing in form fields. */
function useHeldKeys() {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const typing = (e: KeyboardEvent) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      keys.current.add(e.key.toLowerCase());
      if (e.key.startsWith('Arrow')) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);
  return keys;
}

/**
 * Walking in a 2D campus room from VR (left thumbstick moves, right thumbstick snap-turns 30°) or from a laptop
 * (WASD / arrows, camera follows). Collisions use the same map as the 2D players (shared `slide`), and the position
 * goes to the room like a laptop player's, so everyone sees everyone.
 *
 * `pos` is the player in map pixels: in VR it is the head (room-scale walking counts too).
 */
export function useWalker(map: CampusMap, room: Room) {
  const origin = useRef<Group>(null);
  const pos = useRef<{ x: number; y: number } | null>(null);
  const sent = useRef({ x: -1, y: -1, t: 0, moving: false, dir: 'down' as Dir });
  const inVR = useXR((s) => s.mode === 'immersive-vr');
  const camera = useThree((s) => s.camera);
  const desktop = useDesktopView();
  const keys = useHeldKeys();

  const placeOrigin = useCallback(() => {
    const o = origin.current;
    if (!o || !pos.current) return;
    const w = toWorld(pos.current.x, pos.current.y);
    o.position.set(w.x, 0, w.z);
  }, []);

  // spawn where the server put us
  const self = room.snapshot?.self;
  useEffect(() => {
    if (!self || pos.current) return;
    pos.current = { x: self.x, y: self.y };
    placeOrigin();
    const w = toWorld(self.x, self.y);
    desktop.look([w.x, 4.2, w.z + 5.5], [w.x, 0.9, w.z]);
  }, [self, placeOrigin, desktop]);
  // putting the headset on: stand where the laptop player was
  useEffect(() => {
    if (inVR) placeOrigin();
  }, [inVR, placeOrigin]);

  useXRControllerLocomotion(
    (velocity, rotationY, delta) => {
      const o = origin.current;
      if (!o) return;
      if (rotationY) {
        // turn around the head, not the play-area origin: after room-scale steps the view must not swing sideways
        // (into a wall or the table) — the head stays where it is
        camera.getWorldPosition(head);
        const vx = head.x - o.position.x;
        const vz = head.z - o.position.z;
        const c = Math.cos(rotationY);
        const s = Math.sin(rotationY);
        o.rotation.y += rotationY;
        o.position.x += vx - (vx * c + vz * s);
        o.position.z += vz - (-vx * s + vz * c);
      }
      if (!velocity.x && !velocity.z) return;
      camera.getWorldPosition(head);
      const from = toMap(head.x, head.z);
      const to = toMap(head.x + velocity.x * delta, head.z + velocity.z * delta);
      const p = slide(map, from, to);
      o.position.x += (p.x - from.x) * M;
      o.position.z += (p.y - from.y) * M;
    },
    { speed: 2.2 },
    { type: 'snap', degrees: 30 },
  );

  /** test hook / programmatic move by (dx, dy) map pixels */
  const moveBy = useCallback(
    (dx: number, dy: number) => {
      if (!pos.current) return;
      const p = slide(map, pos.current, { x: pos.current.x + dx, y: pos.current.y + dy });
      if (inVR && origin.current) {
        origin.current.position.x += (p.x - pos.current.x) * M;
        origin.current.position.z += (p.y - pos.current.y) * M;
      }
      pos.current = p;
    },
    [map, inVR],
  );

  useFrame((_, dt) => {
    if (!pos.current) return;
    camera.getWorldDirection(look);
    if (inVR) {
      camera.getWorldPosition(head);
      pos.current = toMap(head.x, head.z);
    } else {
      // laptop: WASD relative to where the camera looks
      const k = keys.current;
      const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      if (f || r) {
        const len = Math.hypot(look.x, look.z) || 1;
        const fx = look.x / len;
        const fz = look.z / len;
        const step = DESKTOP_SPEED_PX * dt;
        const nx = pos.current.x + (fx * f - fz * r) * step;
        const ny = pos.current.y + (fz * f + fx * r) * step;
        pos.current = slide(map, pos.current, { x: nx, y: ny });
      }
      const w = toWorld(pos.current.x, pos.current.y);
      desktop.follow([w.x, 0.9, w.z]);
    }

    // tell the room (same throttle as the 2D scene)
    const s = sent.current;
    const now = performance.now();
    const moved = Math.abs(pos.current.x - s.x) > 1 || Math.abs(pos.current.y - s.y) > 1;
    const dir: Dir = Math.abs(look.x) > Math.abs(look.z) ? (look.x < 0 ? 'left' : 'right') : look.z < 0 ? 'up' : 'down';
    if ((moved || s.moving || dir !== s.dir) && now - s.t > SEND_EVERY_MS) {
      room.move(pos.current.x, pos.current.y, dir, moved);
      sent.current = { x: pos.current.x, y: pos.current.y, t: now, moving: moved, dir };
    }
  });

  return { origin, pos, inVR, moveBy };
}

/** On a laptop, the player is a capsule you look at from behind (in VR you are the camera). */
export function SelfMarker({ pos, color = VC.violet }: { pos: { current: { x: number; y: number } | null }; color?: string }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    if (!g.current || !pos.current) return;
    const w = toWorld(pos.current.x, pos.current.y);
    g.current.position.set(w.x, 0, w.z);
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.9, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.42, 32]} />
        <meshBasicMaterial color={VC.sunny} />
      </mesh>
    </group>
  );
}
