'use client';

import { useFrame } from '@react-three/fiber';
import { METERS_PER_PX, type CampusMap, type Furniture, type FurnitureKind, type Rect } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Bousla3D } from '../bousla-3d';
import { VC, VText } from '../kit';

const M = METERS_PER_PX;
const WALL_H = 2.4;
/** floor colors per map token (light theme of the 2D campus) */
const FLOOR: Record<string, string> = { mint: '#dff7ee', sunny: '#fff3d6', sky: '#e3f2ff', violet: '#ece7ff', coral: '#ffeae3' };

/** center of a map rect, in world meters */
export const center = (r: Rect) => ({ x: (r.x + r.w / 2) * M, z: (r.y + r.h / 2) * M });

function Box({ r, h, y = 0, color, cast = true, emissive }: { r: Rect; h: number; y?: number; color: string; cast?: boolean; emissive?: number }) {
  const c = center(r);
  return (
    <mesh position={[c.x, y + h / 2, c.z]} castShadow={cast} receiveShadow>
      <boxGeometry args={[r.w * M, h, r.h * M]} />
      <meshStandardMaterial color={color} roughness={0.85} emissive={emissive ? color : '#000000'} emissiveIntensity={emissive ?? 0} />
    </mesh>
  );
}

/** A pulsing highlight around furniture (live study tables, open exam desks). */
function Glow({ r, color, label }: { r: Rect; color: string; label?: string }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as { opacity: number }).opacity = 0.35 + Math.sin(clock.elapsedTime * 3) * 0.2;
  });
  const c = center(r);
  return (
    <group position={[c.x, 0, c.z]}>
      <mesh ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[r.w * M + 0.6, r.h * M + 0.6]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {label && (
        <group position={[0, 1.35, 0]}>
          <VText size={0.16} bold color={VC.ink} outline={VC.white}>
            {label}
          </VText>
        </group>
      )}
    </group>
  );
}

function Piece({ f, label, needleAngle, screens }: { f: Furniture; label: (s: string) => string; needleAngle?: number | null; screens?: boolean }) {
  const c = center(f);
  const w = f.w * M;
  const d = f.h * M;
  switch (f.kind) {
    case 'rug':
      return (
        <group>
          <mesh position={[c.x, 0.01, c.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial color={VC.violet} transparent opacity={0.12} />
          </mesh>
          {f.label && (
            <group position={[c.x, 0.03, f.y * M + 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
              <VText size={0.35} bold color={VC.violet}>
                {label(f.label)}
              </VText>
            </group>
          )}
        </group>
      );
    case 'table':
    case 'desk':
      return (
        <group>
          <Box r={f} h={0.06} y={0.72} color={VC.wood} />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[c.x + sx * (w / 2 - 0.08), 0.36, c.z + sz * (d / 2 - 0.08)]}>
                <boxGeometry args={[0.06, 0.72, 0.06]} />
                <meshStandardMaterial color={VC.woodDark} />
              </mesh>
            )),
          )}
          {f.kind === 'desk' && screens && (
            <mesh position={[c.x, 0.95, c.z - d / 4]}>
              <boxGeometry args={[0.55, 0.36, 0.03]} />
              <meshStandardMaterial color={VC.sky} emissive={VC.sky} emissiveIntensity={0.3} />
            </mesh>
          )}
        </group>
      );
    case 'bench':
      return <Box r={f} h={0.45} color={VC.wood} />;
    case 'sofa':
      return (
        <group>
          <Box r={f} h={0.45} color={VC.coral} />
          <Box r={{ ...f, h: Math.min(f.h, 12) }} h={0.85} color="#e86a4c" />
        </group>
      );
    case 'shelf':
      return (
        <group>
          <Box r={f} h={1.8} color={VC.woodDark} />
          {[0.4, 0.9, 1.4].map((y, row) =>
            Array.from({ length: Math.max(2, Math.floor(w / 0.18)) }, (_, i) => (
              <mesh key={`${row}-${i}`} position={[f.x * M + 0.12 + i * 0.18, y + 0.15, c.z + d / 2 + 0.02]}>
                <boxGeometry args={[0.12, 0.3, 0.04]} />
                <meshStandardMaterial color={[VC.coral, VC.sky, VC.sunny, VC.mint, VC.violet][(i + row) % 5]} />
              </mesh>
            )),
          )}
        </group>
      );
    case 'plant':
      return (
        <group position={[c.x, 0, c.z]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.15, 0.4, 16]} />
            <meshStandardMaterial color={VC.woodDark} />
          </mesh>
          <mesh position={[0, 0.65, 0]} castShadow>
            <sphereGeometry args={[0.38, 16, 12]} />
            <meshStandardMaterial color={VC.green} />
          </mesh>
        </group>
      );
    case 'tree':
      return (
        <group position={[c.x, 0, c.z]}>
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.25, 2, 12]} />
            <meshStandardMaterial color={VC.woodDark} />
          </mesh>
          <mesh position={[0, 2.8, 0]} castShadow>
            <sphereGeometry args={[Math.max(w, d) * 0.75, 20, 16]} />
            <meshStandardMaterial color="#3c9a3c" />
          </mesh>
        </group>
      );
    case 'fountain':
      return (
        <group position={[c.x, 0, c.z]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[w / 2, w / 2 + 0.1, 0.6, 32]} />
            <meshStandardMaterial color="#cfd6e3" />
          </mesh>
          <mesh position={[0, 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[w / 2 - 0.2, 32]} />
            <meshStandardMaterial color="#8fd6ff" emissive="#8fd6ff" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 0.9, 12]} />
            <meshStandardMaterial color="#cfd6e3" />
          </mesh>
        </group>
      );
    case 'board':
      // mounted on the wall: 2D boards hang on the top wall, so the 3D one faces the room (+z)
      return (
        <group position={[c.x, 1.55, f.y * M + 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[w, 1.1, 0.08]} />
            <meshStandardMaterial color="#1f5f4a" />
          </mesh>
          <mesh position={[0, 0, -0.01]}>
            <boxGeometry args={[w + 0.12, 1.22, 0.06]} />
            <meshStandardMaterial color={VC.woodDark} />
          </mesh>
        </group>
      );
    case 'lamp':
      return (
        <group position={[c.x, 0, c.z]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.6, 8]} />
            <meshStandardMaterial color="#6b5a4a" />
          </mesh>
          <mesh position={[0, 1.65, 0]}>
            <coneGeometry args={[0.28, 0.32, 20, 1, true]} />
            <meshStandardMaterial color="#fff1c1" emissive={VC.sunny} emissiveIntensity={0.6} side={2} />
          </mesh>
        </group>
      );
    case 'bousla':
      return <Bousla3D position={[c.x, 0.65, c.z]} scale={1.6} mood="happy" needleAngle={needleAngle} />;
    default:
      return null;
  }
}

/**
 * Any 2D campus map (courtyard, study room, exam room) as a 3D room: 40 map pixels = 1 m, walls 2.4 m high.
 * Doors glow on the floor; `glowTables` / `glowDesks` light up live study tables and open exam desks;
 * `boardText` is written on the board.
 */
export function MapWorld({
  map,
  glowTables = [],
  glowDesks = false,
  boardText,
  bouslaNeedle,
  skip = [],
}: {
  map: CampusMap;
  /** furniture the scene draws itself (e.g. the life-size Bousla in the exam room) */
  skip?: FurnitureKind[];
  glowTables?: string[];
  glowDesks?: boolean;
  boardText?: string | null;
  bouslaNeedle?: number | null;
}) {
  const t = useTranslations('campus.mapLabels');
  const label = (s: string) => {
    const k = s.replace(/ /g, '_');
    return t.has(k) ? t(k) : s;
  };
  const tables = useMemo(() => map.furniture.filter((f) => f.kind === 'table'), [map]);
  const desks = useMemo(() => map.furniture.filter((f) => f.kind === 'desk'), [map]);
  const board = map.furniture.find((f) => f.kind === 'board');
  const W = map.width * M;
  const D = map.height * M;

  return (
    <group>
      <directionalLight position={[W * 0.3, 14, D * 0.8]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-W} shadow-camera-right={W} shadow-camera-top={D} shadow-camera-bottom={-D} shadow-camera-far={60} />
      <mesh position={[W / 2, 0, D / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={FLOOR[map.floor] ?? FLOOR.violet} roughness={1} />
      </mesh>
      {map.walls.map((w, i) => (
        <Box key={i} r={w} h={WALL_H} color={VC.wall} />
      ))}
      {map.furniture.map((f, i) =>
        skip.includes(f.kind) ? null : (
        <Piece key={i} f={f} label={label} needleAngle={bouslaNeedle} screens={map.id === 'campus'} />
        ),
      )}
      {map.zones
        .filter((z) => z.kind === 'study_door' || z.kind === 'exam_door')
        .map((z) => (
          <group key={z.id}>
            <Glow r={z} color={z.kind === 'exam_door' ? VC.sky : VC.mint} />
            <group position={[center(z).x, 2.0, center(z).z]}>
              <VText size={0.22} bold color={VC.white} outline={z.kind === 'exam_door' ? '#2b8fd6' : '#1aa884'}>
                {label(z.label)}
              </VText>
            </group>
          </group>
        ))}
      {tables.map((f, i) => (glowTables[i] ? <Glow key={`t${i}`} r={f} color={VC.mint} label={glowTables[i]} /> : null))}
      {glowDesks && desks.map((f, i) => <Glow key={`d${i}`} r={f} color={VC.sky} />)}
      {board && (
        <group position={[center(board).x, 1.55, board.y * M + 0.15]}>
          <VText size={board.w * M * (boardText ? 0.03 : 0.05)} bold color={VC.white} maxWidth={board.w * M - 0.4}>
            {boardText?.trim() || label(board.label ?? '')}
          </VText>
        </group>
      )}
    </group>
  );
}
