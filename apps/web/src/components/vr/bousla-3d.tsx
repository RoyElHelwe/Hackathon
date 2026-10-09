'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import type { BouslaMood } from '@/components/bousla';
import { EmojiSprite, VC } from './kit';

/**
 * Bousla, the compass mascot, in 3D — built from simple shapes like the SVG (components/bousla.tsx): violet body,
 * cream face, yellow ticks and crown, a coral needle. About 0.6 m tall at scale 1.
 * `needleAngle` (radians, 0 = up, positive = left) turns the needle toward something (the player, the next mission…).
 */
export function Bousla3D({
  mood = 'happy',
  scale = 1,
  position,
  rotationY = 0,
  needleAngle,
}: {
  mood?: BouslaMood;
  scale?: number;
  position?: [number, number, number];
  rotationY?: number;
  needleAngle?: number | null;
}) {
  const root = useRef<Group>(null);
  const needle = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const mouth = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const r = root.current;
    if (r) {
      // idle float; cheering bounces (an offset inside the placed, scaled group — `position` is applied once, outside)
      r.position.y = mood === 'cheering' ? Math.abs(Math.sin(t * 6)) * 0.08 : Math.sin(t * 1.6) * 0.015;
      r.rotation.z = mood === 'cheering' ? Math.sin(t * 6) * 0.06 : 0;
    }
    const n = needle.current;
    if (n) {
      let target = Math.sin(t * 1.4) * 0.25;
      if (mood === 'thinking') target = n.rotation.z + 0.15;
      else if (mood === 'curious') target = -0.5;
      else if (needleAngle != null) target = needleAngle;
      n.rotation.z = mood === 'thinking' ? target : n.rotation.z + (target - n.rotation.z) * 0.12;
    }
    const e = eyes.current;
    if (e) {
      const blink = t % 4 < 0.12;
      e.scale.y = mood === 'sleepy' ? 0.15 : blink ? 0.1 : 1;
    }
    if (mouth.current) mouth.current.scale.setScalar(mood === 'cheering' ? 1.5 : mood === 'curious' ? 0.6 : 1);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group ref={root}>
        {/* body: a flattened violet ball */}
        <mesh scale={[1, 1, 0.62]} castShadow>
          <sphereGeometry args={[0.25, 32, 24]} />
          <meshStandardMaterial color={VC.violet} roughness={0.5} />
        </mesh>
        {/* cream face */}
        <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.205, 0.205, 0.03, 40]} />
          <meshStandardMaterial color={VC.cream} roughness={0.8} />
        </mesh>
        {/* compass ticks */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 0.17, Math.cos((i * Math.PI) / 2) * 0.17, 0.15]} rotation={[0, 0, (-i * Math.PI) / 2]}>
            <boxGeometry args={[0.018, 0.045, 0.01]} />
            <meshStandardMaterial color={VC.sunny} />
          </mesh>
        ))}
        {/* needle (coral tip up, pink tail down) */}
        <group ref={needle} position={[0, 0.02, 0.16]}>
          <mesh position={[0, 0.07, 0]}>
            <coneGeometry args={[0.028, 0.14, 4]} />
            <meshStandardMaterial color={VC.coral} />
          </mesh>
          <mesh position={[0, -0.05, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.022, 0.1, 4]} />
            <meshStandardMaterial color="#FF9B80" />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <sphereGeometry args={[0.016, 12, 12]} />
            <meshStandardMaterial color={VC.ink} />
          </mesh>
        </group>
        {/* eyes */}
        <group ref={eyes} position={[0, -0.05, 0.165]}>
          {[-0.075, 0.075].map((x) => (
            <mesh key={x} position={[x, 0, 0]} scale={[0.8, 1, 0.5]}>
              <sphereGeometry args={[0.03, 16, 12]} />
              <meshStandardMaterial color={VC.ink} />
            </mesh>
          ))}
        </group>
        {/* smile */}
        <mesh ref={mouth} position={[0, -0.12, 0.162]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.03, 0.007, 8, 16, Math.PI]} />
          <meshStandardMaterial color={VC.ink} />
        </mesh>
        {/* crown */}
        <mesh position={[0, 0.265, 0]}>
          <torusGeometry args={[0.04, 0.013, 10, 24]} />
          <meshStandardMaterial color={VC.sunny} />
        </mesh>
        {/* feet */}
        {[-0.09, 0.09].map((x) => (
          <mesh key={x} position={[x, -0.25, 0.03]} scale={[1.3, 0.6, 1]}>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshStandardMaterial color={VC.violetDark} />
          </mesh>
        ))}
        {mood === 'thinking' && <EmojiSprite emoji="💭" size={0.18} position={[0.25, 0.3, 0]} />}
        {mood === 'cheering' && <EmojiSprite emoji="✨" size={0.2} position={[-0.27, 0.27, 0]} />}
        {mood === 'curious' && <EmojiSprite emoji="❓" size={0.16} position={[0.24, 0.28, 0]} />}
        {mood === 'sleepy' && <EmojiSprite emoji="💤" size={0.16} position={[0.24, 0.28, 0]} />}
      </group>
    </group>
  );
}
