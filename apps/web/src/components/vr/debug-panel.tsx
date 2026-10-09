'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Vector3, type Group } from 'three';
import { Panel, VC, VText } from './kit';

const head = new Vector3();
const fwd = new Vector3();
const left = new Vector3();
const target = new Vector3();
const UP = new Vector3(0, 1, 0);

const MAX = 6;
const lines: string[] = [];
const listeners = new Set<() => void>();
let installed = false;

/** Collects console errors and uncaught errors (no cable needed to see them in the headset). */
function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const push = (msg: string) => {
    lines.push(msg.slice(0, 140));
    if (lines.length > MAX) lines.shift();
    for (const l of listeners) l();
  };
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    orig(...args);
  };
  window.addEventListener('error', (e) => push(`⚠ ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => push(`⚠ ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`));
}

/**
 * `?debug=1`: a panel with FPS and the last errors, low on the left of wherever you look (it follows you lazily,
 * in every scene). This is the "remote debugger" when the Quest is not plugged in.
 */
export function DebugPanel() {
  const camera = useThree((s) => s.camera);
  const g = useRef<Group>(null);
  const placed = useRef(false);
  const [, force] = useState(0);
  const [fps, setFps] = useState(0);
  const frames = useRef({ n: 0, t: 0 });

  useEffect(() => {
    install();
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useFrame((_, dt) => {
    const o = g.current;
    if (o) {
      camera.getWorldPosition(head);
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      left.crossVectors(UP, fwd).normalize();
      target.copy(head).addScaledVector(fwd, 0.9).addScaledVector(left, 0.45);
      target.y = head.y - 0.3;
      // appear in place, then follow lazily
      if (!placed.current || o.position.distanceTo(target) > 0.35) o.position.lerp(target, placed.current ? 0.1 : 1);
      placed.current = true;
      o.lookAt(head);
    }
    const f = frames.current;
    f.n++;
    f.t += dt;
    if (f.t >= 1) {
      setFps(Math.round(f.n / f.t));
      f.n = 0;
      f.t = 0;
    }
  });

  return (
    <group ref={g}>
    <Panel width={0.7} height={0.42} color={VC.panelDark} opacity={0.9}>
      <VText size={0.035} color={fps >= 70 ? VC.mint : fps >= 50 ? VC.sunny : VC.coral} bold position={[0, 0.17, 0]}>
        {`FPS ${fps}`}
      </VText>
      <VText size={0.022} color={VC.white} maxWidth={0.64} anchorY="top" align="left" position={[0, 0.13, 0]}>
        {lines.length ? lines.join('\n') : 'No errors ✓'}
      </VText>
    </Panel>
    </group>
  );
}
