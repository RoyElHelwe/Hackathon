'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSocket } from './socket';
import type { PlayerState } from './types';

type JoinAck = { ok: true; snapshot: { players: PlayerState[] } } | { ok: false; error: string };

/**
 * Silently spectates many exam rooms at once over the tab's one socket (the Exam Hall): who is in each room, who is
 * speaking, and whether each room is joined. Rejoins everything after a reconnect.
 */
export function useSpectateMany(rooms: string[]) {
  const key = [...rooms].sort().join(',');
  const [players, setPlayers] = useState<Record<string, Record<string, PlayerState>>>({});
  const [joined, setJoined] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (!list.length) return;
    const s = getSocket();
    const set = new Set(list);
    let alive = true;

    const join = (room: string) =>
      s
        .timeout(10_000)
        .emitWithAck('room:join', { room, spectate: true })
        .then((ack: JoinAck) => {
          if (!alive || !ack.ok) return;
          setPlayers((p) => ({ ...p, [room]: Object.fromEntries(ack.snapshot.players.map((x) => [x.userId, x])) }));
          setJoined((j) => ({ ...j, [room]: true }));
        })
        .catch(() => undefined);
    const joinAll = () => list.forEach((r) => void join(r));

    const patch = (room: string, userId: string, change: Partial<PlayerState> | null) =>
      setPlayers((p) => {
        const members = { ...(p[room] ?? {}) };
        if (change === null) delete members[userId];
        else if (members[userId]) members[userId] = { ...members[userId], ...change };
        else return p;
        return { ...p, [room]: members };
      });
    const onJoined = (d: { room: string; player: PlayerState }) => {
      if (set.has(d.room)) setPlayers((p) => ({ ...p, [d.room]: { ...(p[d.room] ?? {}), [d.player.userId]: d.player } }));
    };
    const onLeft = (d: { room: string; userId: string }) => set.has(d.room) && patch(d.room, d.userId, null);
    const onSpeaking = (d: { room: string; userId: string; speaking: boolean }) => set.has(d.room) && patch(d.room, d.userId, { speaking: d.speaking });
    const onListening = (d: { room: string; userId: string; listening: boolean }) => set.has(d.room) && patch(d.room, d.userId, { listening: d.listening });
    const onDisconnect = () => alive && setJoined({});

    s.on('connect', joinAll);
    s.on('disconnect', onDisconnect);
    s.on('player:joined', onJoined);
    s.on('player:left', onLeft);
    s.on('player:speaking', onSpeaking);
    s.on('player:listening', onListening);
    if (s.connected) joinAll();
    else s.connect();

    return () => {
      alive = false;
      s.off('connect', joinAll);
      s.off('disconnect', onDisconnect);
      s.off('player:joined', onJoined);
      s.off('player:left', onLeft);
      s.off('player:speaking', onSpeaking);
      s.off('player:listening', onListening);
      if (s.connected) for (const room of list) s.emit('room:leave', { room });
      setJoined({});
    };
  }, [key]);

  /** Start/stop hearing one of the rooms. */
  const listen = useCallback((room: string, on: boolean) => {
    getSocket().emit('spectate:listen', { room, on });
  }, []);

  const lists = useMemo(() => Object.fromEntries(Object.entries(players).map(([room, m]) => [room, Object.values(m)])), [players]);

  return { players: lists, joined, listen };
}
