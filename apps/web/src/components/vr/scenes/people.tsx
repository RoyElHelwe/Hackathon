'use client';

import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { EMOTE_EMOJI, toWorld, type PlayerState } from '@tajriba/shared';
import { useEffect, useRef, useState } from 'react';
import type { Group, Mesh } from 'three';
import type { useRoom } from '@/lib/campus/use-room';
import { EmojiSprite, VC, VText } from '../kit';

type Room = ReturnType<typeof useRoom>;

/** One classmate: a capsule in their avatar color with eyes, name tag, level badge, speaking ring and emotes. */
function Person({ p, room }: { p: PlayerState; room: Room }) {
  const g = useRef<Group>(null);
  const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const target = useRef(toWorld(p.x, p.y));
  const facing = useRef(p.dir);
  const lastMove = useRef(0);
  const [emoji, setEmoji] = useState<{ e: string; at: number } | null>(null);
  const [speaking, setSpeaking] = useState(!!p.speaking);

  useEffect(
    () =>
      room.subscribe((e) => {
        if (e.type === 'moved' && e.userId === p.userId) {
          target.current = toWorld(e.x, e.y);
          facing.current = e.dir;
          lastMove.current = performance.now();
        } else if ((e.type === 'emote' || e.type === 'reaction') && e.userId === p.userId) {
          setEmoji({ e: e.type === 'emote' ? EMOTE_EMOJI[e.emote] : e.emoji, at: performance.now() });
        } else if (e.type === 'speaking' && e.userId === p.userId) setSpeaking(e.speaking);
      }),
    [room, p.userId],
  );
  useEffect(() => {
    if (!emoji) return;
    const t = window.setTimeout(() => setEmoji(null), 1800);
    return () => window.clearTimeout(t);
  }, [emoji]);

  useFrame(({ clock }) => {
    const o = g.current;
    if (!o) return;
    // glide toward the latest position (updates arrive every ~60 ms)
    o.position.x += (target.current.x - o.position.x) * 0.25;
    o.position.z += (target.current.z - o.position.z) * 0.25;
    const yaw = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 }[facing.current];
    const turn = ((yaw - o.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // shortest way round
    o.rotation.y += turn * 0.2;
    const walking = performance.now() - lastMove.current < 350;
    if (body.current) body.current.position.y = walking ? Math.abs(Math.sin(clock.elapsedTime * 12)) * 0.06 : 0;
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 8) * 0.08);
  });

  const start = toWorld(p.x, p.y);
  return (
    <group ref={g} position={[start.x, 0, start.z]}>
      <group ref={body}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <capsuleGeometry args={[0.24, 0.9, 8, 16]} />
          <meshStandardMaterial color={p.color} roughness={0.6} />
        </mesh>
        {/* eyes on the side it faces */}
        {[-0.08, 0.08].map((x) => (
          <group key={x} position={[x, 1.15, 0.2]}>
            <mesh>
              <sphereGeometry args={[0.055, 12, 10]} />
              <meshStandardMaterial color={VC.white} />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <sphereGeometry args={[0.028, 10, 8]} />
              <meshStandardMaterial color={VC.ink} />
            </mesh>
          </group>
        ))}
      </group>
      {speaking && (
        <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.36, 0.44, 32]} />
          <meshBasicMaterial color={VC.mint} />
        </mesh>
      )}
      <Billboard position={[0, 1.85, 0]}>
        <VText size={0.13} bold color={VC.white} outline={VC.ink}>
          {p.role === 'TEACHER' ? `${p.name} 🎓` : p.level ? `${p.name} · ${p.level}` : p.name}
        </VText>
        {emoji && <EmojiSprite emoji={emoji.e} size={0.45} position={[0, 0.4, 0]} />}
      </Billboard>
    </group>
  );
}

/** Everyone else in the room (spectating teachers are invisible, like in 2D). */
export function People({ room }: { room: Room }) {
  return (
    <>
      {room.players
        .filter((p) => !p.spectator)
        .map((p) => (
          <Person key={p.userId} p={p} room={room} />
        ))}
    </>
  );
}
