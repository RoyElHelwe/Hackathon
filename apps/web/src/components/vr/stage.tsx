'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { createXRStore, useXR, XR, type XRStore } from '@react-three/xr';
import { metaQuest2, XRDevice } from 'iwer';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { DebugPanel } from './debug-panel';
import { vrTest } from './test-hook';

type V3 = [number, number, number];

/**
 * `?emulate=1`: a Meta Quest 2 emulator (IWER) replaces the browser's WebXR — VR on a laptop and in Playwright
 * (tests move the headset and controllers through `__tajribaVR.emulator`). Forced, because Chrome has its own
 * headset-less WebXR and the emulator would otherwise step aside. Installed when this module loads (VR pages only),
 * outside React rendering. Its on-screen DevUI is not used: it ships its own copy of three.js.
 */
const EMULATING = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('emulate') === '1';
if (EMULATING) {
  const device = new XRDevice(metaQuest2);
  device.installRuntime({ forceInstall: true });
  vrTest({ emulator: device });
}

/** The XR store for a page. A real Quest is never emulated. */
export function useVRStore(): XRStore {
  return useMemo(() => {
    return createXRStore({
      // the library's own emulator would load a second three.js; ours is installed above
      emulate: false,
      // controller layouts and 3D models are served by Tajriba (public/xr-profiles: Quest 2 + Quest 3), not a CDN —
      // works offline, in tests and on school networks; other devices fall back to the Quest 2 layout
      ...({ baseAssetPath: `${window.location.origin}/xr-profiles/`, defaultControllerProfileId: 'oculus-touch-v3' } as object),
      // Quest 2: lighter fragment work at the edges of the lenses
      foveation: 1,
      // 72 Hz (Quest 2's native rate); 'high' would pick 120 Hz, which real-time shadows can't hold
      frameRate: (rates: ArrayLike<number>) => (Array.from(rates).includes(72) ? 72 : Math.min(...Array.from(rates))),
    });
  }, []);
}

type XRNav = Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } };

/**
 * Can this browser enter VR? Re-checked when the emulator finishes injecting itself (it does that asynchronously,
 * after asking the real browser first).
 */
export function useVRSupported(store: XRStore): { vr: boolean | null; ar: boolean | null } {
  const [res, setRes] = useState<{ vr: boolean | null; ar: boolean | null }>({ vr: null, ar: null });
  useEffect(() => {
    let alive = true;
    const check = () => {
      const xr = (navigator as XRNav).xr;
      if (!xr) return void setRes({ vr: false, ar: false });
      const ask = (m: string) => xr.isSessionSupported(m).catch(() => false);
      void Promise.all([ask('immersive-vr'), ask('immersive-ar')]).then(([vr, ar]) => alive && setRes({ vr, ar }));
    };
    check();
    const unsub = store.subscribe((s, prev) => {
      if (s.emulator && !prev.emulator) check();
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [store]);
  return res;
}

interface DesktopView {
  /** places the laptop (non-VR) camera; scenes call it when they mount */
  look(position: V3, target: V3): void;
  /** moves the orbit target to a point and the camera along with it (third-person follow of the player) */
  follow(target: V3): void;
}
const DesktopCtx = createContext<DesktopView>({ look: () => undefined, follow: () => undefined });
export const useDesktopView = () => useContext(DesktopCtx);

/** Tells the test hook (and the page) whether a VR session is running. */
function SessionWatch({ onChange }: { onChange?: (inVR: boolean) => void }) {
  const mode = useXR((s) => s.mode);
  useEffect(() => {
    vrTest({ session: mode ?? 'none' });
    onChange?.(mode === 'immersive-vr');
  }, [mode, onChange]);
  return null;
}

function DesktopCamera({ children }: { children: ReactNode }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const inVR = useXR((s) => s.mode === 'immersive-vr');
  const view = useMemo<DesktopView>(
    () => ({
      look: (position, target) => {
        camera.position.set(...position);
        controls.current?.target.set(...target);
        controls.current?.update();
      },
      follow: (target) => {
        const c = controls.current;
        if (!c) return;
        const dx = target[0] - c.target.x;
        const dy = target[1] - c.target.y;
        const dz = target[2] - c.target.z;
        if (!dx && !dy && !dz) return;
        c.target.set(...target);
        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z += dz;
        c.update();
      },
    }),
    [camera],
  );
  return (
    <DesktopCtx.Provider value={view}>
      {!inVR && <OrbitControls ref={controls} makeDefault enableDamping maxPolarAngle={Math.PI * 0.49} minDistance={0.6} maxDistance={40} />}
      {children}
    </DesktopCtx.Provider>
  );
}

/**
 * Canvas + XR + friendly default lighting. Works the same in a Quest (immersive-vr), in the emulator and as a normal
 * 3D page with the mouse (orbit) on a laptop.
 */
export function XRStage({ store, children, debug, onSession, sky = '#d9ecff' }: { store: XRStore; children: ReactNode; debug?: boolean; onSession?: (inVR: boolean) => void; sky?: string }) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [0, 1.6, 2.2], fov: 60, near: 0.05, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      data-testid="vr-canvas"
    >
      <color attach="background" args={[sky]} />
      <hemisphereLight args={['#ffffff', '#b9a8ff', 0.9]} />
      <ambientLight intensity={0.35} />
      <XR store={store}>
        <SessionWatch onChange={onSession} />
        <DesktopCamera>
          {children}
          {debug && <DebugPanel />}
        </DesktopCamera>
      </XR>
    </Canvas>
  );
}
