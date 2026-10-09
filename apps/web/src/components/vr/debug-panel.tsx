'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Panel, VC, VText } from './kit';

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
 * `?debug=1`: a panel with FPS and the last errors, floating low on the left of the player.
 * This is the "remote debugger" when the Quest is not plugged in.
 */
export function DebugPanel({ position = [-0.75, 0.9, -1.1] }: { position?: [number, number, number] }) {
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
    <Panel width={0.7} height={0.42} position={position} rotation={[0, 0.5, 0]} color={VC.panelDark} opacity={0.9}>
      <VText size={0.035} color={fps >= 70 ? VC.mint : fps >= 50 ? VC.sunny : VC.coral} bold position={[0, 0.17, 0]}>
        {`FPS ${fps}`}
      </VText>
      <VText size={0.022} color={VC.white} maxWidth={0.64} anchorY="top" align="left" position={[0, 0.13, 0]}>
        {lines.length ? lines.join('\n') : 'No errors ✓'}
      </VText>
    </Panel>
  );
}
