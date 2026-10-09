'use client';

import { EMOTE_EMOJI, MAPS, type CampusMap, type Zone } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { useRoom } from '@/lib/campus/use-room';
import type { SceneApi } from './scene';

type Room = ReturnType<typeof useRoom>;

interface Props {
  room: Room;
  /** a fixed map id, or a map built at runtime (the Exam Hall) — keep the object stable (useMemo) */
  map: CampusMap['id'] | CampusMap;
  interactive?: boolean;
  /** local mic level → speaking ring on my avatar */
  selfSpeaking?: boolean;
  onZone?: (zone: Zone | null) => void;
  onApi?: (api: SceneApi | null) => void;
  className?: string;
}

/**
 * The 2D campus (Phaser 3, loaded only in the browser). Movement is sent to the room; other players are driven by
 * room events without React re-renders.
 */
export function CampusCanvas({ room, map: mapProp, interactive = true, selfSpeaking, onZone, onApi, className }: Props) {
  const map = typeof mapProp === 'string' ? MAPS[mapProp as keyof typeof MAPS] : mapProp;
  const t = useTranslations('campus.mapLabels');
  const trRef = useRef((label: string) => (t.has(label.replace(/ /g, '_')) ? t(label.replace(/ /g, '_')) : label));
  trRef.current = (label: string) => (t.has(label.replace(/ /g, '_')) ? t(label.replace(/ /g, '_')) : label);
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const zoneRef = useRef(onZone);
  zoneRef.current = onZone;
  const apiCb = useRef(onApi);
  apiCb.current = onApi;

  // Boot Phaser once per map.
  useEffect(() => {
    let game: import('phaser').Game | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import('phaser');
      const Phaser = ((mod as unknown as { default?: typeof import('phaser') }).default ?? mod) as typeof import('phaser');
      if (cancelled || !host.current) return;
      const { createCampusScene } = await import('./scene');
      const dark = document.documentElement.classList.contains('dark');
      const Scene = createCampusScene(Phaser, {
        map,
        interactive,
        dark,
        translate: (label) => trRef.current(label),
        onMove: (x, y, dir, moving) => roomRef.current.move(x, y, dir, moving),
        onZone: (z) => zoneRef.current?.(z),
        onReady: (a) => {
          api.current = a;
          const r = roomRef.current;
          if (r.snapshot) {
            a.setSelf(r.snapshot.self);
            for (const p of r.players) a.upsert(p);
          }
          apiCb.current?.(a);
        },
      });
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        backgroundColor: dark ? '#0b0920' : '#dcd6f7',
        scale: { mode: Phaser.Scale.RESIZE, width: host.current.clientWidth || 640, height: host.current.clientHeight || 400 },
        physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
        render: { antialias: true, roundPixels: false },
        audio: { noAudio: true },
        banner: false,
        scene: Scene,
      });
    })();
    return () => {
      cancelled = true;
      api.current = null;
      apiCb.current?.(null);
      game?.destroy(true);
    };
  }, [map, interactive]);

  // Room events → scene.
  useEffect(
    () =>
      room.subscribe((e) => {
        const a = api.current;
        if (!a) return;
        switch (e.type) {
          case 'snapshot':
            a.clearOthers();
            a.setSelf(e.snapshot.self);
            for (const p of e.snapshot.players) a.upsert(p);
            break;
          case 'joined':
            a.upsert(e.player);
            break;
          case 'moved':
            a.move(e.userId, e.x, e.y, e.dir, e.moving);
            break;
          case 'left':
            a.remove(e.userId);
            break;
          case 'emote':
            a.emote(e.userId, EMOTE_EMOJI[e.emote]);
            break;
          case 'reaction':
            a.emote(e.userId, e.emoji);
            break;
          case 'speaking':
            a.speaking(e.userId, e.speaking);
            break;
        }
      }),
    [room.subscribe], // eslint-disable-line react-hooks/exhaustive-deps -- subscribe is stable per room hook
  );

  const selfId = room.self?.userId;
  useEffect(() => {
    if (selfId) api.current?.speaking(selfId, !!selfSpeaking);
  }, [selfSpeaking, selfId]);

  return (
    <div
      ref={host}
      className={cn('relative overflow-hidden rounded-[20px] border-2 border-border bg-violet-soft [&_canvas]:block', className)}
      data-testid={`campus-canvas-${map.id}`}
      role="application"
      aria-label="2D campus"
    />
  );
}
