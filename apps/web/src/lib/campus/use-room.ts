'use client';

import type { Emote, RoomSnapshot } from '@tajriba/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from './socket';
import type { PlayerState } from './types';

export type RoomEvent =
  | { type: 'snapshot'; snapshot: RoomSnapshot }
  | { type: 'joined'; player: PlayerState }
  | { type: 'moved'; userId: string; x: number; y: number; dir: PlayerState['dir']; moving: boolean }
  | { type: 'left'; userId: string }
  | { type: 'emote'; userId: string; emote: Emote }
  | { type: 'reaction'; userId: string; emoji: string }
  | { type: 'speaking'; userId: string; speaking: boolean }
  | { type: 'listening'; userId: string; listening: boolean };

export type RoomStatus = 'idle' | 'connecting' | 'joined' | 'reconnecting' | 'error';

type JoinAck = { ok: true; snapshot: RoomSnapshot; publishes: boolean } | { ok: false; error: string };

/**
 * Joins a campus room over Socket.IO and keeps the list of people in it.
 * Re-joins automatically after a reconnect (the server keeps us "present" for a grace period, so others never notice).
 * High-frequency events (movement) go to `subscribe` listeners without re-rendering React.
 */
export function useRoom(room: string | null, opts: { spectate?: boolean } = {}) {
  const spectate = !!opts.spectate;
  const [status, setStatus] = useState<RoomStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [publishes, setPublishes] = useState(false);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const positions = useRef(new Map<string, PlayerState>());
  const listeners = useRef(new Set<(e: RoomEvent) => void>());

  const fire = useCallback((e: RoomEvent) => {
    for (const l of listeners.current) l(e);
  }, []);

  useEffect(() => {
    if (!room) return;
    const s = getSocket();
    let alive = true;
    setStatus(s.connected ? 'connecting' : 'connecting');

    const join = () => {
      s.timeout(10_000)
        .emitWithAck('room:join', { room, spectate })
        .then((ack: JoinAck) => {
          if (!alive) return;
          if (!ack.ok) {
            setError(ack.error);
            setStatus('error');
            return;
          }
          positions.current = new Map(ack.snapshot.players.map((p) => [p.userId, { ...p }]));
          setPlayers(Object.fromEntries(ack.snapshot.players.map((p) => [p.userId, p])));
          setSnapshot(ack.snapshot);
          setPublishes(ack.publishes);
          setError(null);
          setStatus('joined');
          fire({ type: 'snapshot', snapshot: ack.snapshot });
        })
        .catch(() => {
          if (!alive) return;
          setError('timeout');
          setStatus('error');
        });
    };

    const mine = (d: { room?: string }) => d?.room === room;
    const onJoined = (d: { room: string; player: PlayerState }) => {
      if (!mine(d)) return;
      positions.current.set(d.player.userId, { ...d.player });
      setPlayers((p) => ({ ...p, [d.player.userId]: d.player }));
      fire({ type: 'joined', player: d.player });
    };
    const onMoved = (d: { room: string; userId: string; x: number; y: number; dir: PlayerState['dir']; moving: boolean }) => {
      if (!mine(d)) return;
      const p = positions.current.get(d.userId);
      if (p) Object.assign(p, { x: d.x, y: d.y, dir: d.dir, moving: d.moving });
      fire({ type: 'moved', userId: d.userId, x: d.x, y: d.y, dir: d.dir, moving: d.moving });
    };
    const onLeft = (d: { room: string; userId: string }) => {
      if (!mine(d)) return;
      positions.current.delete(d.userId);
      setPlayers((p) => {
        const next = { ...p };
        delete next[d.userId];
        return next;
      });
      fire({ type: 'left', userId: d.userId });
    };
    const onEmote = (d: { room: string; userId: string; emote: Emote }) => mine(d) && fire({ type: 'emote', userId: d.userId, emote: d.emote });
    const onReaction = (d: { room: string; userId: string; emoji: string }) => mine(d) && fire({ type: 'reaction', userId: d.userId, emoji: d.emoji });
    const onSpeaking = (d: { room: string; userId: string; speaking: boolean }) => {
      if (!mine(d)) return;
      setPlayers((p) => (p[d.userId] ? { ...p, [d.userId]: { ...p[d.userId], speaking: d.speaking } } : p));
      fire({ type: 'speaking', userId: d.userId, speaking: d.speaking });
    };
    const onListening = (d: { room: string; userId: string; listening: boolean }) => {
      if (!mine(d)) return;
      setPlayers((p) => (p[d.userId] ? { ...p, [d.userId]: { ...p[d.userId], listening: d.listening } } : p));
      fire({ type: 'listening', userId: d.userId, listening: d.listening });
    };
    const onConnect = () => join();
    const onDisconnect = () => alive && setStatus('reconnecting');
    const onConnectError = () => {
      if (!alive) return;
      setError('unauthorized');
      setStatus('reconnecting');
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.on('player:joined', onJoined);
    s.on('player:moved', onMoved);
    s.on('player:left', onLeft);
    s.on('player:emote', onEmote);
    s.on('player:reaction', onReaction);
    s.on('player:speaking', onSpeaking);
    s.on('player:listening', onListening);
    if (s.connected) join();
    else s.connect();

    return () => {
      alive = false;
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.off('player:joined', onJoined);
      s.off('player:moved', onMoved);
      s.off('player:left', onLeft);
      s.off('player:emote', onEmote);
      s.off('player:reaction', onReaction);
      s.off('player:speaking', onSpeaking);
      s.off('player:listening', onListening);
      if (s.connected) s.emit('room:leave', { room });
      setStatus('idle');
    };
  }, [room, spectate, fire]);

  const subscribe = useCallback((l: (e: RoomEvent) => void) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }, []);

  const actions = useMemo(() => {
    const s = () => getSocket();
    return {
      move: (x: number, y: number, dir: PlayerState['dir'], moving: boolean) => room && s().emit('move', { room, x, y, dir, moving }),
      emote: (emote: Emote) => room && s().emit('emote', { room, emote }),
      reaction: (emoji: string) => room && s().emit('reaction', { room, emoji }),
      speaking: (speaking: boolean) => room && s().emit('speaking', { room, speaking }),
      transcript: (text: string) => room && s().volatile.emit('exam:transcript', { room, text }),
      /** spectators: start/stop hearing this exam room */
      listen: (on: boolean) => room && s().emit('spectate:listen', { room, on }),
    };
  }, [room]);

  const others = useMemo(() => Object.values(players), [players]);

  return { status, error, snapshot, self: snapshot?.self ?? null, players: others, positions, publishes, subscribe, ...actions };
}

/** Listens to a server event (any room) while mounted. */
export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const h = (d: T) => ref.current(d);
    s.on(event, h);
    return () => {
      s.off(event, h);
    };
  }, [event]);
}
