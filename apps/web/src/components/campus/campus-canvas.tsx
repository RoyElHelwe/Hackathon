'use client';

import { EMOTE_EMOJI, MAPS, type CampusMap, type Zone } from '@tajriba/shared';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { useRoom } from '@/lib/campus/use-room';
import type { ArzinoLayer } from './arzino-3d';
import type { SceneApi } from './scene';

type Room = ReturnType<typeof useRoom>;

/** Given to HUD children so they can adapt (and leave full screen before opening a dialog). */
export interface CampusFullscreen {
  full: boolean;
  exit: () => void;
}

interface Props {
  room: Room;
  /** a fixed map id, or a map built at runtime (the Exam Hall) — keep the object stable (useMemo) */
  map: CampusMap['id'] | CampusMap;
  interactive?: boolean;
  /** local mic level → speaking ring on my avatar */
  selfSpeaking?: boolean;
  onZone?: (zone: Zone | null) => void;
  onApi?: (api: SceneApi | null) => void;
  /** told when the canvas enters / leaves full screen (pages move HUD pieces like the emote bar inside) */
  onFullscreen?: (full: boolean) => void;
  /** size of the canvas in the page (ignored in full screen) */
  className?: string;
  /** HUD overlays drawn over the canvas; they stay visible in full screen */
  children?: React.ReactNode | ((fs: CampusFullscreen) => React.ReactNode);
}

type FsElement = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

const fsElement = () => document.fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null;

/**
 * The 2D campus (Phaser 3, loaded only in the browser). Movement is sent to the room; other players are driven by
 * room events without React re-renders. A corner button puts the canvas and its HUD in full screen (Fullscreen API,
 * or a fixed overlay where the API is missing, e.g. iPhone Safari).
 */
export function CampusCanvas({ room, map: mapProp, interactive = true, selfSpeaking, onZone, onApi, onFullscreen, className, children }: Props) {
  const map = typeof mapProp === 'string' ? MAPS[mapProp as keyof typeof MAPS] : mapProp;
  const t = useTranslations('campus.mapLabels');
  const tc = useTranslations('campus');
  const trRef = useRef((label: string) => (t.has(label.replace(/ /g, '_')) ? t(label.replace(/ /g, '_')) : label));
  trRef.current = (label: string) => (t.has(label.replace(/ /g, '_')) ? t(label.replace(/ /g, '_')) : label);
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const layerHost = useRef<HTMLDivElement>(null);
  const layer = useRef<ArzinoLayer | null>(null);
  const game = useRef<import('phaser').Game | null>(null);
  const api = useRef<SceneApi | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const zoneRef = useRef(onZone);
  zoneRef.current = onZone;
  const apiCb = useRef(onApi);
  apiCb.current = onApi;

  // ---------- full screen ----------
  const [mode, setMode] = useState<null | 'native' | 'css'>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const full = mode !== null;
  const fsCb = useRef(onFullscreen);
  fsCb.current = onFullscreen;
  useEffect(() => fsCb.current?.(full), [full]);

  const exit = useCallback(() => {
    if (modeRef.current === 'native' && fsElement()) {
      const d = document as FsDocument;
      void (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.())?.catch?.(() => undefined);
    }
    setMode(null);
  }, []);

  const enter = useCallback(async () => {
    const el = wrap.current as FsElement | null;
    if (!el) return;
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (!request) return setMode('css');
    // some embedded browsers never settle the request: fall back to the overlay instead of doing nothing
    const slow = window.setTimeout(() => !fsElement() && setMode('css'), 700);
    try {
      await request.call(el);
      setMode(fsElement() ? 'native' : 'css');
    } catch {
      setMode('css');
    } finally {
      window.clearTimeout(slow);
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (modeRef.current === 'native' && fsElement() !== wrap.current) setMode(null);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // CSS fallback: Esc closes it and the page behind must not scroll.
  useEffect(() => {
    if (mode !== 'css') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMode(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mode]);

  // Leaving the page while in full screen: hand the screen back.
  useEffect(() => () => void (modeRef.current === 'native' && fsElement() && document.exitFullscreen?.().catch(() => undefined)), []);

  // Keep Phaser's canvas the size of its box (page layout, full screen, rotation).
  useEffect(() => {
    const el = host.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const scale = game.current?.scale;
      if (!scale) return;
      scale.getParentBounds();
      scale.refresh();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- Phaser: boot once per map ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('phaser');
      const Phaser = ((mod as unknown as { default?: typeof import('phaser') }).default ?? mod) as typeof import('phaser');
      // map labels use the page font; wait (briefly) for it so Phaser doesn't bake a fallback font into its textures
      await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 800))]);
      if (cancelled || !host.current) return;
      const { createCampusScene } = await import('./scene');
      const dark = document.documentElement.classList.contains('dark');
      // the 3D Arzinos load in parallel; until then (or if WebGL fails) the flat avatars are shown
      void import('./arzino-3d')
        .then(({ ArzinoLayer }) => (layerHost.current ? ArzinoLayer.create(layerHost.current, dark) : null))
        .then((l) => {
          if (cancelled) l?.dispose();
          else layer.current = l;
          if (process.env.NODE_ENV === 'development') (window as Window & { __arzino?: ArzinoLayer | null }).__arzino = l;
        });
      const Scene = createCampusScene(Phaser, {
        map,
        interactive,
        dark,
        font: getComputedStyle(document.body).fontFamily,
        translate: (label) => trRef.current(label),
        layer: () => layer.current,
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
      game.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        backgroundColor: dark ? '#08130f' : '#e6f2eb',
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
      game.current?.destroy(true);
      game.current = null;
      layer.current?.dispose();
      layer.current = null;
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
      ref={wrap}
      className={cn(
        'relative isolate overflow-hidden bg-cedar-soft',
        full ? 'fixed inset-0 z-[45] h-[100dvh] w-screen' : cn('rounded-[20px] border-2 border-border shadow-[0_4px_0_0_var(--border)]', className),
      )}
      data-testid={`campus-canvas-${map.id}`}
      data-fullscreen={full || undefined}
    >
      <div ref={host} className="absolute inset-0 [&_canvas]:block" role="application" aria-label="2D campus" />
      <div ref={layerHost} className="pointer-events-none absolute inset-0" aria-hidden />
      {typeof children === 'function' ? children({ full, exit }) : children}
      <button
        type="button"
        onClick={() => (full ? exit() : void enter())}
        className="absolute end-3 top-3 z-20 flex size-11 items-center justify-center rounded-[14px] border-2 border-border bg-card text-foreground shadow-[0_3px_0_0_var(--border)] transition-transform hover:bg-muted active:translate-y-[3px] active:shadow-none"
        aria-label={full ? tc('fullscreen.exit') : tc('fullscreen.enter')}
        title={full ? `${tc('fullscreen.exit')} (Esc)` : tc('fullscreen.enter')}
        aria-pressed={full}
        data-testid="campus-fullscreen"
      >
        {full ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
      </button>
    </div>
  );
}
