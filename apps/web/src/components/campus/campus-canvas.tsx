'use client';

import { EMOTE_EMOJI, MAPS, type CampusMap, type Zone } from '@tajriba/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { useRoom } from '@/lib/campus/use-room';
import type { SceneApi } from './scene';

type Room = ReturnType<typeof useRoom>;

/** keys the scene uses for walking; the browser would scroll the page with them */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Follows the `dark` class on <html> (the theme toggle), so the map can be redrawn in the new theme. */
function useDarkClass() {
  // read on first render too, so a dark-mode user doesn't boot the map twice
  const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains('dark'));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

interface Props {
  room: Room;
  map: CampusMap['id'];
  interactive?: boolean;
  /** local mic level → speaking ring on my avatar */
  selfSpeaking?: boolean;
  onZone?: (zone: Zone | null) => void;
  onApi?: (api: SceneApi | null) => void;
  /** tapped another player's avatar */
  onPlayerTap?: (userId: string) => void;
  /** closest other player within reach changed */
  onNear?: (userId: string | null) => void;
  className?: string;
}

/**
 * The 2D campus (Phaser 3, loaded only in the browser). Movement is sent to the room; other players are driven by
 * room events without React re-renders.
 */
export function CampusCanvas({ room, map, interactive = true, selfSpeaking, onZone, onApi, onPlayerTap, onNear, className }: Props) {
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
  const tapRef = useRef(onPlayerTap);
  tapRef.current = onPlayerTap;
  const nearRef = useRef(onNear);
  nearRef.current = onNear;
  const dark = useDarkClass();
  const locale = useLocale();
  /** where I was standing when the scene was last torn down (theme/language switch → redraw in place) */
  const lastSelf = useRef<{ map: string; x: number; y: number } | null>(null);

  // Boot Phaser once per map, theme and language (labels and colors are drawn at boot).
  useEffect(() => {
    let game: import('phaser').Game | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import('phaser');
      const Phaser = ((mod as unknown as { default?: typeof import('phaser') }).default ?? mod) as typeof import('phaser');
      if (cancelled || !host.current) return;
      const { createCampusScene } = await import('./scene');
      const Scene = createCampusScene(Phaser, {
        map: MAPS[map],
        interactive,
        dark,
        translate: (label) => trRef.current(label),
        onMove: (x, y, dir, moving) => roomRef.current.move(x, y, dir, moving),
        onZone: (z) => zoneRef.current?.(z),
        onPlayerTap: (id) => tapRef.current?.(id),
        onNear: (id) => nearRef.current?.(id),
        onReady: (a) => {
          api.current = a;
          // test hook (dev/e2e only): lets Playwright walk to exact map points
          if (process.env.NODE_ENV !== 'production') (window as unknown as { __tajribaScene?: SceneApi }).__tajribaScene = a;
          const r = roomRef.current;
          if (r.snapshot) {
            const was = lastSelf.current?.map === map ? lastSelf.current : null;
            a.setSelf(was ? { ...r.snapshot.self, x: was.x, y: was.y } : r.snapshot.self);
            // live positions (kept up to date by the room hook), not the join-time list
            for (const p of r.positions.current.values()) a.upsert(p);
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
      const pos = api.current?.selfPos();
      if (pos) lastSelf.current = { map, ...pos };
      api.current = null;
      apiCb.current?.(null);
      game?.destroy(true);
    };
  }, [map, interactive, dark, locale]);

  // Walking with the arrow keys must not scroll the page while the map is on screen.
  useEffect(() => {
    const el = host.current;
    if (!interactive || !el) return;
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    const onKey = (e: KeyboardEvent) => {
      if (!visible || !SCROLL_KEYS.has(e.key)) return;
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      io.disconnect();
      window.removeEventListener('keydown', onKey);
    };
  }, [interactive]);

  // Room events → scene.
  useEffect(
    () =>
      room.subscribe((e) => {
        const a = api.current;
        if (!a) return;
        switch (e.type) {
          case 'snapshot':
            lastSelf.current = null; // the server's position wins after a (re)join
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
      data-testid={`campus-canvas-${map}`}
      role="application"
      aria-label="2D campus"
    />
  );
}
