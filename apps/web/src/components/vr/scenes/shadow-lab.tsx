'use client';

import { useFrame } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import { heightChoices, heightFromShadows, shadowLength } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DoubleSide, Shape, type DirectionalLight, type Group, type Mesh, type Object3D } from 'three';
import type { BouslaMood } from '../bousla-3d';
import { Bousla3D } from '../bousla-3d';
import { EmojiSprite, Panel, VButton, VC, VText } from '../kit';
import { useVRNav } from '../nav';
import { useDesktopView } from '../stage';
import { vrTest, vrTestClear } from '../test-hook';

// ---- the lab's world (meters). The sun rises in the east (+x), so shadows stretch west (−x), across the view. ----
const YOU = { x: 2.5, z: -4, h: 1.5, r: 0.12 };
const BUILDING = { x: 7, z: -11, w: 4, d: 4 };
const HEIGHTS = [9, 12, 15, 18];
const SUN_MIN = 30;
const SUN_MAX = 65;
const SUN_DIST = 30;
const CENTER = { x: 2, z: -8 };

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const STEPS = ['intro', 'sun', 'measureYou', 'measureBuilding', 'triangles', 'done'] as const;

const fmt = (v: number, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
const rad = (deg: number) => (deg * Math.PI) / 180;

/** A right triangle standing on the ground: vertical side = height, ground side = shadow (pointing −x). */
function ShadowTriangle({ x, z, height, shadow, color, opacity = 0.45 }: { x: number; z: number; height: number; shadow: number; color: string; opacity?: number }) {
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(0, 0);
    s.lineTo(0, height);
    s.lineTo(-shadow, 0);
    s.closePath();
    return s;
  }, [height, shadow]);
  return (
    <mesh position={[x, 0.02, z]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Measuring tape on the ground from a base point to the shadow tip, with the length written on it. */
function Tape({ x, z, length, label }: { x: number; z: number; length: number; label: string }) {
  return (
    <group position={[x, 0.03, z]}>
      <mesh position={[-length / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, 0.12]} />
        <meshBasicMaterial color={VC.sunny} />
      </mesh>
      <group position={[-length / 2, 0.45, 0]}>
        <VText size={0.32} bold color={VC.ink} outline={VC.white}>
          {label}
        </VText>
      </group>
    </group>
  );
}

/** "Point here and press the trigger": a pulsing ring at a shadow tip (big invisible hit area for easy aiming). */
function TipMarker({ x, z, onHit, name }: { x: number; z: number; onHit: () => void; name: string }) {
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.15);
  });
  return (
    <group position={[x, 0.04, z]} name={name}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.5, 40]} />
        <meshBasicMaterial color={VC.coral} />
      </mesh>
      <mesh
        position={[0, 0.5, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onHit();
        }}
      >
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <EmojiSprite emoji="👇" size={0.7} position={[0, 1.3, 0]} />
    </group>
  );
}

/** A few colorful bits that burst up and fall — the "you got it" moment. */
function Confetti({ at }: { at: [number, number, number] }) {
  const group = useRef<Group>(null);
  const bits = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        color: [VC.violet, VC.mint, VC.sunny, VC.coral, VC.sky][i % 5],
        v: [(Math.random() - 0.5) * 3, 2.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3] as [number, number, number],
      })),
    [],
  );
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    const g = group.current;
    if (!g) return;
    g.children.forEach((c: Object3D, i) => {
      const b = bits[i];
      c.position.set(b.v[0] * t.current, b.v[1] * t.current - 4.9 * t.current * t.current, b.v[2] * t.current);
      c.rotation.x += dt * 6;
      c.rotation.y += dt * 4;
      c.visible = t.current < 2.5;
    });
  });
  return (
    <group ref={group} position={at}>
      {bits.map((b, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.05, 0.05, 0.01]} />
          <meshBasicMaterial color={b.color} />
        </mesh>
      ))}
    </group>
  );
}

function Building({ height }: { height: number }) {
  const floors = Math.round(height / 3);
  return (
    <group position={[BUILDING.x, 0, BUILDING.z]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BUILDING.w, height, BUILDING.d]} />
        <meshStandardMaterial color="#e8dcff" roughness={0.9} />
      </mesh>
      {/* windows on the side facing the player */}
      {Array.from({ length: floors }, (_, f) =>
        [-1, 0, 1].map((c) => (
          <mesh key={`${f}-${c}`} position={[c * 1.2, 1.5 + f * 3, BUILDING.d / 2 + 0.01]}>
            <planeGeometry args={[0.7, 1.1]} />
            <meshStandardMaterial color={VC.sky} emissive={VC.sky} emissiveIntensity={0.25} />
          </mesh>
        )),
      )}
      <mesh position={[0, height + 0.15, 0]}>
        <boxGeometry args={[BUILDING.w + 0.2, 0.3, BUILDING.d + 0.2]} />
        <meshStandardMaterial color={VC.violet} />
      </mesh>
    </group>
  );
}

function You() {
  return (
    <group position={[YOU.x, 0, YOU.z]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[YOU.r, 1.0, 6, 12]} />
        <meshStandardMaterial color={VC.mint} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 12]} />
        <meshStandardMaterial color={VC.mint} />
      </mesh>
    </group>
  );
}

/**
 * The Shadow Lab: similar triangles with the sun. Move the sun, measure your shadow and the building's shadow, see the
 * two triangles are the same shape, and find the building's height (H = h × S ÷ s). Practice only — no XP.
 */
export function ShadowLab({ missionId }: { missionId?: string }) {
  const t = useTranslations('vr.lab');
  const { go } = useVRNav();
  const desktop = useDesktopView();
  const [step, setStep] = useState<Step>(0);
  const [sun, setSun] = useState(45);
  const [moves, setMoves] = useState(0);
  const [round, setRound] = useState(0);
  const [measured, setMeasured] = useState<{ s?: number; S?: number }>({});
  const [wrong, setWrong] = useState(false);
  const H = HEIGHTS[round % HEIGHTS.length];
  const s = shadowLength(YOU.h, sun);
  const S = shadowLength(H, sun);
  const choices = useMemo(() => heightChoices(H, round + 1), [H, round]);
  const light = useRef<DirectionalLight>(null);

  // laptop view: close enough to read the guide card, wide enough to see both shadows
  useEffect(() => desktop.look([-0.4, 2.1, 1.9], [1.2, 1.2, -5]), [desktop]);

  // the sun and its light follow the elevation
  const sunPos: [number, number, number] = [CENTER.x + Math.cos(rad(sun)) * SUN_DIST, Math.sin(rad(sun)) * SUN_DIST, CENTER.z];
  useEffect(() => {
    light.current?.target.position.set(CENTER.x, 0, CENTER.z);
    light.current?.target.updateMatrixWorld();
  }, []);

  const moveSun = useCallback((deg: number) => {
    setSun(Math.max(SUN_MIN, Math.min(SUN_MAX, deg)));
    setMoves((m) => m + 1);
  }, []);
  const measure = useCallback(
    (which: 's' | 'S') => {
      if (which === 's' && step === 2) {
        setMeasured((m) => ({ ...m, s }));
        setStep(3);
      } else if (which === 'S' && step === 3) {
        setMeasured((m) => ({ ...m, S }));
        setStep(4);
      }
    },
    [step, s, S],
  );
  const answer = useCallback(
    (v: number) => {
      if (measured.s == null || measured.S == null) return;
      const right = Math.abs(v - heightFromShadows(YOU.h, measured.s, measured.S)) < 0.11;
      setWrong(!right);
      if (right) setStep(5);
    },
    [measured],
  );
  const again = useCallback(() => {
    setRound((r) => r + 1);
    setMeasured({});
    setWrong(false);
    setMoves(0);
    setSun(40 + ((round * 7) % 20));
    setStep(1);
  }, [round]);

  // test hook (dev only): drive the lab without aiming rays
  useEffect(() => {
    vrTest({ step, lab: { setSun: moveSun, measure, answer, next: () => setStep((n) => (n < 2 ? ((n + 1) as Step) : n)), height: H, choices } });
  }, [step, moveSun, measure, answer, H, choices]);
  useEffect(() => () => vrTestClear(['lab']), []);

  const mood: BouslaMood = step === 5 ? 'cheering' : wrong ? 'curious' : step === 4 ? 'thinking' : 'happy';
  const youBase = YOU.x - YOU.r;
  const bBase = BUILDING.x - BUILDING.w / 2;

  return (
    <>
      <XROrigin position={[0, 0, 0]} />
      <color attach="background" args={['#bfe3ff']} />
      <fog attach="fog" args={['#bfe3ff', 40, 90]} />
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#cdeec0" roughness={1} />
      </mesh>
      {/* the sun and its light (real shadows) */}
      <mesh position={sunPos}>
        <sphereGeometry args={[1.6, 24, 16]} />
        <meshBasicMaterial color={VC.sunny} />
      </mesh>
      <directionalLight
        ref={light}
        position={sunPos}
        intensity={2.2}
        castShadow
        // 1024 over 40 m ≈ 4 cm per texel: enough for the 24 cm-wide figure, light enough for a Quest 2 at 72 Hz
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
      />
      <Building height={H} />
      <You />
      <group position={[YOU.x, 2.0, YOU.z]}>
        <VText size={0.22} bold color={VC.ink} outline={VC.white}>
          {t('you', { h: fmt(YOU.h) })}
        </VText>
      </group>

      {/* measuring */}
      {step === 2 && <TipMarker x={youBase - s} z={YOU.z} onHit={() => measure('s')} name="tip-you" />}
      {step === 3 && <TipMarker x={bBase - S} z={BUILDING.z} onHit={() => measure('S')} name="tip-building" />}
      {measured.s != null && <Tape x={youBase} z={YOU.z + 0.3} length={measured.s} label={`s = ${fmt(measured.s, 2)} m`} />}
      {measured.S != null && <Tape x={bBase} z={BUILDING.z + BUILDING.d / 2 + 0.4} length={measured.S} label={`S = ${fmt(measured.S, 1)} m`} />}

      {/* the "aha": both shadows are the same triangle, one is just bigger */}
      {step >= 4 && measured.s != null && measured.S != null && (
        <>
          <ShadowTriangle x={youBase} z={YOU.z} height={YOU.h} shadow={measured.s} color={VC.mint} />
          <ShadowTriangle x={bBase} z={BUILDING.z + BUILDING.d / 2 + 0.05} height={H} shadow={measured.S} color={VC.violet} opacity={0.3} />
          <GrowingTriangle from={{ x: youBase, z: YOU.z }} to={{ x: bBase, z: BUILDING.z + BUILDING.d / 2 + 0.1 }} h={YOU.h} s={measured.s} scale={H / YOU.h} />
        </>
      )}
      {step === 5 && <Confetti at={[0, 1.6, -1.6]} />}

      {/* guide: Arzino + the step card, at the player's left */}
      <Bousla3D mood={mood} position={[-1.15, 1.15, -1.6]} rotationY={0.5} scale={0.8} />
      <Panel width={0.95} height={0.78} position={[-0.25, 1.35, -1.45]} rotation={[0, 0.18, 0]}>
        <VText size={0.034} bold color={VC.violet} position={[0, 0.33, 0]}>
          {t('stepOf', { n: Math.min(step + 1, 5), total: 5 })}
        </VText>
        <VText size={0.05} bold position={[0, 0.25, 0]} maxWidth={0.88}>
          {t(`${STEPS[step]}.title`)}
        </VText>
        <VText size={0.034} position={[0, 0.12, 0]} maxWidth={0.86} anchorY="top">
          {step === 4
            ? t('triangles.body', { h: fmt(YOU.h), s: fmt(measured.s ?? 0, 2), S: fmt(measured.S ?? 0, 1), ratio: fmt(YOU.h / (measured.s ?? 1), 2) })
            : step === 5
              ? t('done.body', { H: fmt(H) })
              : wrong
                ? t('wrong')
                : t(`${STEPS[step]}.body`)}
        </VText>
        {step === 0 && <VButton label={t('start')} onClick={() => setStep(1)} position={[0, -0.28, 0]} name="lab-start" />}
        {step === 1 && (
          <VButton label={t('next')} onClick={() => setStep(2)} disabled={moves < 2} position={[0, -0.28, 0]} color={VC.mint} textColor={VC.ink} name="lab-next" />
        )}
        {step === 4 &&
          choices.map((c, i) => (
            <VButton key={c} label={`${fmt(c)} m`} onClick={() => answer(c)} position={[(i - 1) * 0.3, -0.28, 0]} width={0.27} color={VC.sky} name={`lab-choice-${i}`} />
          ))}
        {step === 5 && (
          <>
            <VButton label={t('again')} onClick={again} position={[-0.23, -0.28, 0]} width={0.4} color={VC.mint} textColor={VC.ink} name="lab-again" />
            <VButton label={missionId ? t('toMission') : t('home')} onClick={() => (missionId ? window.location.assign(`/student/missions/${missionId}`) : go({ kind: 'hub' }))} position={[0.23, -0.28, 0]} width={0.4} name="lab-exit" />
          </>
        )}
      </Panel>

      {/* the sun lever, at the player's right */}
      {step >= 1 && step <= 4 && (
        <Panel width={0.5} height={0.5} position={[0.85, 1.2, -1.2]} rotation={[0, -0.45, 0]}>
          <EmojiSprite emoji="☀️" size={0.12} position={[0, 0.17, 0.02]} />
          <VText size={0.045} bold position={[0, 0.07, 0]}>
            {t('sunAngle', { deg: Math.round(sun) })}
          </VText>
          <VButton label={t('higher')} onClick={() => moveSun(sun + 5)} disabled={step > 1 || sun >= SUN_MAX} position={[0, -0.04, 0]} width={0.4} height={0.09} color={VC.sunny} textColor={VC.ink} name="sun-up" />
          <VButton label={t('lower')} onClick={() => moveSun(sun - 5)} disabled={step > 1 || sun <= SUN_MIN} position={[0, -0.16, 0]} width={0.4} height={0.09} color={VC.coral} name="sun-down" />
        </Panel>
      )}
    </>
  );
}

/** A copy of your small triangle flies to the building and grows ×(H/h) until it covers the big one exactly. */
function GrowingTriangle({ from, to, h, s, scale }: { from: { x: number; z: number }; to: { x: number; z: number }; h: number; s: number; scale: number }) {
  const g = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current = Math.min(1, t.current + dt / 3);
    const k = t.current < 0.5 ? 0 : (t.current - 0.5) * 2; // first fly, then grow
    const fly = Math.min(1, t.current * 2);
    const e = 1 - (1 - fly) ** 3;
    if (g.current) {
      g.current.position.set(from.x + (to.x - from.x) * e, 0, from.z + (to.z - from.z) * e);
      g.current.scale.setScalar(1 + (scale - 1) * (1 - (1 - k) ** 3));
    }
  });
  return (
    <group ref={g}>
      <ShadowTriangle x={0} z={0} height={h} shadow={s} color={VC.sunny} opacity={0.5} />
    </group>
  );
}
