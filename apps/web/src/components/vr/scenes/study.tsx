'use client';

import { XROrigin } from '@react-three/xr';
import { distance, EMOTES, EMOTE_EMOJI, MAPS, STUDY_MIN_XP_MS, voiceGain } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { mmss } from '@/components/campus/use-countdown';
import { api } from '@/lib/api';
import type { DiscussionCard, StudySessionDetail } from '@/lib/campus/types';
import { useRecorder } from '@/lib/campus/use-recorder';
import { useRoom, useSocketEvent } from '@/lib/campus/use-room';
import { useVoice } from '@/lib/campus/use-voice';
import { useApi, useInvalidate, useMe } from '@/lib/hooks';
import { Bousla3D } from '../bousla-3d';
import { EmojiSprite, VButton, VC, VText } from '../kit';
import { useVRNav } from '../nav';
import { vrTest, vrTestClear } from '../test-hook';
import { Belt, FacingPanel } from './hud';
import { People } from './people';
import { SelfMarker, useWalker } from './walker';
import { MapWorld } from './world';

const MAP = MAPS.study;
const first = (name?: string) => name?.trim().split(/\s+/)[0] ?? '';

/** Study room in VR: loads the session, then the live room (or the accept / ended card). */
export function StudyScene({ id }: { id: string }) {
  const t = useTranslations('campus');
  const tv = useTranslations('vr.campus');
  const { go } = useVRNav();
  const { data: me } = useMe();
  const path = `/study-sessions/${id}`;
  const session = useApi<StudySessionDetail>(path, { refetchInterval: (q) => (q.state.data?.status === 'INVITED' ? 4000 : false) });
  const invalidate = useInvalidate();
  const [ended, setEnded] = useState<{ xp: number } | null>(null);

  useSocketEvent<{ sessionId: string; reason?: string; xpBy?: Record<string, number> }>('study:ended', (d) => {
    if (d.sessionId !== id) return;
    if (d.reason !== 'DECLINED') setEnded({ xp: (me && d.xpBy?.[me.user.id]) || 0 });
    void invalidate(path, '/gamification/me');
  });
  useSocketEvent<{ sessionId: string }>('study:accepted', (d) => d.sessionId === id && void invalidate(path));
  useSocketEvent<{ sessionId: string }>('study:status', (d) => d.sessionId === id && void invalidate(path));

  const s = session.data;
  const myId = me?.user.id;
  const back = (
    <>
      <XROrigin position={[10, 0, 11]} />
      <MapWorld map={MAP} />
    </>
  );
  if (!s || !myId) return back;
  const partner = s.participants.find((p) => p.userId !== myId);

  if (ended || s.status === 'ENDED' || s.status === 'DECLINED' || s.status === 'EXPIRED') {
    return (
      <>
        {back}
        <Bousla3D mood="cheering" position={[10, 1.2, 9.4]} />
        <FacingPanel width={0.9} height={0.42}>
          <VText size={0.06} bold position={[0, 0.12, 0]}>
            {t('study.endedTitle')}
          </VText>
          <VText size={0.04} maxWidth={0.84} position={[0, 0.03, 0]}>
            {ended?.xp ? t('study.xp', { xp: ended.xp }) : s.status === 'ENDED' || ended ? t('study.endedBody') : t(`sessions.status.${s.status}`)}
          </VText>
          <VButton label={tv('backToCampus')} onClick={() => go({ kind: 'campus' })} position={[0, -0.12, 0]} width={0.5} name="vr-back-campus" />
        </FacingPanel>
      </>
    );
  }

  if (s.status === 'INVITED' && s.hostId !== myId) {
    return (
      <>
        {back}
        <FacingPanel width={0.9} height={0.32}>
          <VText size={0.045} bold maxWidth={0.84} position={[0, 0.06, 0]}>
            {t('study.invitedYou', { name: first(partner?.name) })}
          </VText>
          <VButton
            label={t('study.accept')}
            onClick={async () => {
              await api(`${path}/accept`, { method: 'POST' });
              await invalidate(path);
            }}
            position={[0, -0.08, 0]}
            width={0.5}
            name="vr-accept-study"
          />
        </FacingPanel>
      </>
    );
  }

  return <StudyRoomLive session={s} myId={myId} />;
}

function StudyRoomLive({ session, myId }: { session: StudySessionDetail; myId: string }) {
  const t = useTranslations('campus');
  const tv = useTranslations('vr.campus');
  const room = useRoom(session.room);
  const walker = useWalker(MAP, room);
  const voice = useVoice({ room: session.room, selfId: myId, publishes: room.publishes, peers: room.players, joined: room.status === 'joined' });
  const { data: cfg } = useApi<{ recordStudySessions?: boolean }>('/auth/config');
  const rec = useRecorder({ kind: 'STUDY', refId: session.id, stream: voice.stream, active: session.status === 'ACTIVE' && cfg?.recordStudySessions === true });
  const cards = useApi<{ cards: DiscussionCard[] }>(`/study-sessions/${session.id}/cards`, { staleTime: Infinity });
  const [boardMode, setBoardMode] = useState<'mission' | 'cards'>(session.mission ? 'mission' : 'cards');
  const [together, setTogether] = useState({ ms: session.togetherMs, since: session.togetherSince });
  const [now, setNow] = useState(() => Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const partner = session.participants.find((p) => p.userId !== myId);
  const partnerHere = room.players.some((p) => p.userId === partner?.userId && !p.spectator);

  useSocketEvent<{ sessionId: string; togetherMs: number; since: string | null }>('study:together', (d) => {
    if (d.sessionId === session.id) setTogether({ ms: d.togetherMs, since: d.since });
  });
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const togetherMs = together.ms + (together.since ? Math.max(0, now - new Date(together.since).getTime()) : 0);

  // voice on as soon as we're in (entering VR was the click that allows the mic)
  const { enable, enabled } = voice;
  useEffect(() => {
    if (room.status === 'joined' && room.publishes && !enabled) void enable(true);
  }, [room.status, room.publishes, enabled, enable]);
  const { speaking: emitSpeaking } = room;
  useEffect(() => {
    emitSpeaking(voice.speaking);
  }, [voice.speaking, emitSpeaking]);
  // proximity voice: closer = louder (same curve as the 2D room)
  const { setVolume } = voice;
  const { pos } = walker;
  useEffect(() => {
    const iv = window.setInterval(() => {
      const me = pos.current;
      if (!me) return;
      for (const [id, p] of room.positions.current) setVolume(id, voiceGain(distance(me, p)));
    }, 300);
    return () => window.clearInterval(iv);
  }, [pos, room.positions, setVolume]);

  const list = cards.data?.cards ?? [];
  const card = list.length ? list[room.boardIndex % list.length] : null;
  const boardText =
    boardMode === 'mission' && session.mission
      ? [session.mission.title, ...session.mission.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`)].join('\n')
      : card
        ? `${t(`study.cards.${card.kind}`)}: ${card.prompt}`
        : null;

  useEffect(() => {
    vrTest({ study: { moveBy: walker.moveBy, pos: () => pos.current, nextCard: () => room.board(room.boardIndex + 1), boardIndex: room.boardIndex, togetherMs, voice: voice.enabled } });
  }, [walker.moveBy, pos, room, togetherMs, voice.enabled]);
  useEffect(() => () => vrTestClear(['study']), []);

  const end = async () => {
    rec.stop();
    await api(`/study-sessions/${session.id}/end`, { method: 'POST' }).catch(() => undefined);
  };

  return (
    <>
      <XROrigin ref={walker.origin} />
      <color attach="background" args={['#fff3d6']} />
      <MapWorld map={MAP} boardText={boardText} />
      <People room={room} />
      {!walker.inVR && <SelfMarker pos={pos} color={room.self?.color} />}
      <Belt width={1.1} height={0.36}>
        <VText size={0.034} bold color={partnerHere ? VC.mint : '#7a7594'} position={[-0.3, 0.12, 0]}>
          {partnerHere ? t('study.here', { name: first(partner?.name) }) : t('study.away', { name: first(partner?.name) })}
        </VText>
        <VText size={0.034} bold color={togetherMs >= STUDY_MIN_XP_MS ? VC.mint : VC.violet} position={[0.28, 0.12, 0]}>
          {togetherMs >= STUDY_MIN_XP_MS ? `${t('study.together', { time: mmss(Math.floor(togetherMs / 1000)) })} · ${t('study.togetherDone')}` : t('study.together', { time: mmss(Math.floor(togetherMs / 1000)) })}
        </VText>
        {EMOTES.map((e, i) => (
          <group key={e} position={[-0.47 + i * 0.105, 0.02, 0]}>
            <VButton label="" onClick={() => room.emote(e)} width={0.09} height={0.09} color="#efeafe" name={`vr-emote-${e}`} />
            <EmojiSprite emoji={EMOTE_EMOJI[e]} size={0.06} position={[0, 0, 0.05]} />
          </group>
        ))}
        <VButton label={voice.micOn ? tv('micOn') : tv('micOff')} onClick={voice.toggleMic} disabled={!voice.stream} position={[0.33, 0.02, 0]} width={0.3} height={0.08} color={voice.micOn ? VC.mint : '#d9d4f0'} textColor={VC.ink} name="vr-mic" />
        {session.mission ? (
          <VButton label={boardMode === 'mission' ? t('study.board.cards') : t('study.board.mission')} onClick={() => setBoardMode((m) => (m === 'mission' ? 'cards' : 'mission'))} position={[-0.3, -0.1, 0]} width={0.3} height={0.08} color={VC.sky} name="vr-board-mode" />
        ) : null}
        <VButton label={tv('nextCard')} onClick={() => room.board(room.boardIndex + 1)} disabled={boardMode === 'mission' && !!session.mission} position={[0.02, -0.1, 0]} width={0.3} height={0.08} color={VC.sunny} textColor={VC.ink} name="vr-next-card" />
        <VButton label={confirmEnd ? tv('endSure') : t('study.end')} onClick={() => (confirmEnd ? void end() : setConfirmEnd(true))} position={[0.36, -0.1, 0]} width={0.3} height={0.08} color={VC.coral} name="vr-end" />
      </Belt>
    </>
  );
}
