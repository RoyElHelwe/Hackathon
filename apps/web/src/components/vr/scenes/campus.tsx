'use client';

import { XROrigin } from '@react-three/xr';
import { EMOTES, EMOTE_EMOJI, MAPS, zoneAt, type Emote, type PlayerState, type Zone } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useCampusData } from '@/lib/campus/use-campus';
import { useRoom, useSocketEvent } from '@/lib/campus/use-room';
import { useL } from '@/lib/hooks';
import { useNextMission } from '@/lib/next-mission';
import { EmojiSprite, VButton, VC, VText } from '../kit';
import { useVRNav } from '../nav';
import { vrTest, vrTestClear } from '../test-hook';
import { Belt, FacingPanel } from './hud';
import { People } from './people';
import { SelfMarker, useWalker } from './walker';
import { MapWorld } from './world';

const MAP = MAPS.campus;
const PANEL_ZONES = new Set<Zone['kind']>(['study_door', 'exam_door', 'npc']);
const NEAR_PX = 60; // 1.5 m
const first = (name: string) => name.trim().split(/\s+/)[0] ?? '';

type Invite = { sessionId: string; fromName: string; topic?: string | null; help?: boolean };

/** Invite a classmate or accept an invite — in VR this switches scene instead of navigating (keeps the headset on). */
function useVRStudy() {
  const { go } = useVRNav();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('campus');
  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? String(e.data.code ?? '') : '';
    setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic'));
  };
  const invite = async (partnerId: string) => {
    setBusy(partnerId);
    setError(null);
    try {
      const s = await api<{ id: string }>('/study-sessions', { body: { partnerId } });
      go({ kind: 'study', id: s.id });
    } catch (e) {
      if (e instanceof ApiError && e.data.code === 'ALREADY_IN_SESSION' && e.data.sessionId) return go({ kind: 'study', id: String(e.data.sessionId) });
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const accept = async (id: string) => {
    setBusy(id);
    try {
      await api(`/study-sessions/${id}/accept`, { method: 'POST' });
      go({ kind: 'study', id });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  /** "Not now" really declines, so the classmate who invited isn't left waiting (same as the 2D pop-up). */
  const decline = (id: string) => api(`/study-sessions/${id}/decline`, { method: 'POST' }).then(() => undefined, () => undefined);
  return { invite, accept, decline, busy, error };
}

/**
 * The school courtyard in VR: the same room as the 2D campus (laptop classmates walk next to you), with the same
 * doors, Arzino and classmate cards as floating panels.
 */
export function CampusScene() {
  const t = useTranslations('vr.campus');
  const tc = useTranslations('campus');
  const l = useL();
  const { go } = useVRNav();
  const room = useRoom('campus');
  const walker = useWalker(MAP, room);
  const data = useCampusData();
  const study = useVRStudy();
  const next = useNextMission();
  const [zone, setZone] = useState<Zone | null>(null);
  const [near, setNear] = useState<PlayerState | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);

  useSocketEvent<Invite>('study:invite', setInvite);

  // what is around me (5×/s is plenty for panels)
  const { pos } = walker;
  const players = room.players;
  useEffect(() => {
    const iv = window.setInterval(() => {
      const p = pos.current;
      if (!p) return;
      const z = zoneAt(MAP, p.x, p.y);
      const panelZone = z && PANEL_ZONES.has(z.kind) ? z : null;
      setZone((cur) => (cur?.id === panelZone?.id ? cur : panelZone));
      let best: PlayerState | null = null;
      let bestD = NEAR_PX;
      for (const o of players) {
        if (o.spectator) continue;
        const q = room.positions.current.get(o.userId) ?? o;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      setNear((cur) => (cur?.userId === best?.userId ? cur : best));
    }, 200);
    return () => window.clearInterval(iv);
  }, [pos, players, room.positions]);

  const emote = useCallback((e: Emote) => room.emote(e), [room]);
  useEffect(() => {
    vrTest({ campus: { zone: () => zone?.kind ?? null, near: () => near?.userId ?? null, moveBy: walker.moveBy, pos: () => pos.current, emote } });
  }, [zone, near, walker.moveBy, pos, emote]);
  useEffect(() => () => vrTestClear(['campus']), []);

  const tables = (data.liveRooms.data ?? []).map((r) => tc('liveTable', { a: r.names[0] ?? '', b: r.names[1] ?? '' }));
  const mate = near ? data.mates.data?.find((m) => m.userId === near.userId) : undefined;

  let panel: React.ReactNode = null;
  if (invite) {
    panel = (
      <FacingPanel key={`inv-${invite.sessionId}`} width={0.9} height={0.42}>
        <EmojiSprite emoji="📚" size={0.12} position={[0, 0.13, 0.02]} />
        <VText size={0.045} bold maxWidth={0.82} position={[0, 0.03, 0]}>
          {invite.help && invite.topic ? tc('invites.help', { name: first(invite.fromName), topic: invite.topic }) : tc('invites.from', { name: first(invite.fromName) })}
        </VText>
        <VButton label={tc('invites.accept')} onClick={() => study.accept(invite.sessionId)} position={[-0.2, -0.12, 0]} width={0.34} name="vr-invite-join" />
        <VButton label={tc('invites.decline')} onClick={() => study.decline(invite.sessionId).then(() => setInvite(null))} position={[0.2, -0.12, 0]} width={0.34} color="#d9d4f0" textColor={VC.ink} name="vr-invite-decline" />
      </FacingPanel>
    );
  } else if (zone?.kind === 'study_door') {
    const mates = (data.mates.data ?? []).slice(0, 4);
    panel = (
      <FacingPanel key="study-door" width={0.9} height={0.2 + Math.max(1, mates.length) * 0.12}>
        <VText size={0.05} bold position={[0, 0.03 + Math.max(1, mates.length) * 0.06, 0]}>
          {tc('doors.study_door.title')}
        </VText>
        {mates.length === 0 && <VText size={0.035}>{tc('doors.noMates')}</VText>}
        {mates.map((m, i) => (
          <group key={m.userId} position={[0, Math.max(1, mates.length) * 0.06 - 0.06 - i * 0.12, 0]}>
            <mesh position={[-0.38, 0, 0.01]}>
              <circleGeometry args={[0.018, 16]} />
              <meshBasicMaterial color={m.online ? VC.mint : '#b8b3cf'} />
            </mesh>
            <VText size={0.04} anchorX="left" position={[-0.34, 0, 0]}>
              {m.name}
            </VText>
            <VButton label={tc('classmates.invite')} onClick={() => study.invite(m.userId)} disabled={!!study.busy} position={[0.3, 0, 0]} width={0.24} height={0.09} name={`vr-invite-${first(m.name).toLowerCase()}`} />
          </group>
        ))}
      </FacingPanel>
    );
  } else if (zone?.kind === 'exam_door') {
    panel = (
      <FacingPanel key="exam-door" width={0.9} height={0.34}>
        <VText size={0.05} bold position={[0, 0.1, 0]}>
          {tc('doors.exam_door.title')}
        </VText>
        {data.enterable.length ? (
          <>
            <VText size={0.038} position={[0, 0.02, 0]} maxWidth={0.82}>
              {data.enterable[0].title}
            </VText>
            <VButton label={tc('exams.enter')} onClick={() => go({ kind: 'exam', id: data.enterable[0].attemptId })} position={[0, -0.09, 0]} width={0.5} color={VC.sky} name="vr-enter-exam" />
          </>
        ) : (
          <VText size={0.036} maxWidth={0.82} position={[0, -0.03, 0]}>
            {tc('doors.noExam')}
          </VText>
        )}
      </FacingPanel>
    );
  } else if (zone?.kind === 'npc') {
    const m = next.mission;
    const lab = m?.topic?.key === 'geo.similar';
    panel = (
      <FacingPanel key="arzino" width={0.9} height={0.36}>
        <VText size={0.032} bold color={VC.violet} position={[0, 0.12, 0]}>
          {tc('npc.next')}
        </VText>
        <VText size={0.048} bold maxWidth={0.84} position={[0, 0.05, 0]}>
          {m ? l(m.title) : tc('npc.done')}
        </VText>
        {m &&
          (lab ? (
            <VButton label={t('practiceLab')} onClick={() => go({ kind: 'shadow-lab', missionId: m.id })} position={[0, -0.09, 0]} width={0.6} color={VC.sunny} textColor={VC.ink} name="vr-bousla-lab" />
          ) : (
            <VText size={0.032} color="#5b5675" maxWidth={0.84} position={[0, -0.08, 0]}>
              {t('startOnScreen')}
            </VText>
          ))}
      </FacingPanel>
    );
  } else if (near) {
    panel = (
      <FacingPanel key={`near-${near.userId}`} width={0.8} height={0.3}>
        <VText size={0.05} bold position={[0, 0.08, 0]}>
          {near.level ? `${near.name} · ${tc('player.level', { n: near.level })}` : near.name}
        </VText>
        <VButton label={tc('player.wave')} onClick={() => emote('wave')} position={[-0.19, -0.06, 0]} width={0.32} color="#d9d4f0" textColor={VC.ink} name="vr-wave" />
        {mate && !data.mine.length && <VButton label={tc('player.invite')} onClick={() => study.invite(mate.userId)} position={[0.19, -0.06, 0]} width={0.36} name="vr-player-invite" />}
      </FacingPanel>
    );
  }

  return (
    <>
      <XROrigin ref={walker.origin} />
      <color attach="background" args={['#cfe9ff']} />
      <MapWorld map={MAP} glowTables={tables} glowDesks={data.enterable.length > 0} bouslaNeedle={zone?.kind === 'npc' ? 0 : null} />
      <People room={room} />
      {!walker.inVR && <SelfMarker pos={pos} color={room.self?.color} />}
      {panel}
      {study.error && (
        <FacingPanel key={`err-${study.error}`} width={0.8} height={0.16} distance={1.3}>
          <VText size={0.036} color={VC.coral} maxWidth={0.74}>
            {study.error}
          </VText>
        </FacingPanel>
      )}
      <Belt width={1.0} height={0.24}>
        {EMOTES.map((e, i) => (
          <VButton key={e} label={EMOTE_EMOJI[e]} onClick={() => emote(e)} position={[-0.42 + i * 0.12, 0.04, 0]} width={0.1} height={0.1} color="#efeafe" name={`vr-emote-${e}`} />
        ))}
        <group position={[-0.42 + 3 * 0.12, 0.04, 0]}>
          {EMOTES.map((e, i) => (
            <EmojiSprite key={e} emoji={EMOTE_EMOJI[e]} size={0.07} position={[(i - 3) * 0.12, 0, 0.05]} />
          ))}
        </group>
        <VButton label={t('home')} onClick={() => go({ kind: 'hub' })} position={[0.36, -0.07, 0]} width={0.22} height={0.07} color={VC.violet} />
        <VText size={0.028} color="#5b5675" position={[-0.1, -0.07, 0]}>
          {room.status === 'joined' ? tc('online', { n: room.players.filter((p) => !p.spectator).length }) : tc('connecting')}
        </VText>
      </Belt>
    </>
  );
}
