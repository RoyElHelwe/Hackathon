'use client';

import type { ThreeEvent } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import { MAPS, toWorld } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { BouslaMood } from '@/components/bousla';
import { mmss, useCountdown } from '@/components/campus/use-countdown';
import { api, ApiError } from '@/lib/api';
import { useSpeechToText, useTextToSpeech } from '@/lib/campus/speech';
import type { AttemptView } from '@/lib/campus/types';
import { useRecorder } from '@/lib/campus/use-recorder';
import { useRoom, useSocketEvent } from '@/lib/campus/use-room';
import { useVoice } from '@/lib/campus/use-voice';
import { useApi, useInvalidate } from '@/lib/hooks';
import { Bousla3D } from '../bousla-3d';
import { EmojiSprite, Panel, VButton, VC, VText } from '../kit';
import { useVRNav } from '../nav';
import { useDesktopView } from '../stage';
import { vrTest, vrTestClear } from '../test-hook';
import { MapWorld } from './world';

const MAP = MAPS.exam;
/** the student sits at the desk, Bousla stands across it (map pixels → meters) */
const SEAT = toWorld(360, 330);
const BOUSLA = toWorld(360, 175);
/** the student's feeling (from the AI) → Bousla's reaction (same as the 2D exam room) */
const BOUSLA_FOR: Record<string, BouslaMood> = { nervous: 'happy', confused: 'curious', confident: 'cheering', happy: 'cheering', calm: 'happy', thinking: 'thinking' };

/**
 * Tap to start talking, tap again when done (controller trigger or mouse). A toggle, not press-and-hold: holding a
 * ray steady on a small button for a whole answer is hard, and drifting off it must not cut the answer.
 */
function TalkButton({ label, onToggle, active, position, disabled }: { label: string; onToggle: () => void; active: boolean; position: [number, number, number]; disabled?: boolean }) {
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!disabled) onToggle();
  };
  return (
    <group position={position} name="vr-talk">
      <RoundedBox args={[0.62, 0.13, 0.04]} radius={0.03} smoothness={3} position={[0, 0, active ? 0.006 : 0.02]} onClick={click}>
        <meshStandardMaterial color={disabled ? '#9a95b8' : active ? VC.coral : VC.violet} emissive={active ? VC.coral : '#000000'} emissiveIntensity={active ? 0.4 : 0} />
      </RoundedBox>
      <VText size={0.05} bold color={VC.white} position={[0, 0, active ? 0.03 : 0.045]}>
        {label}
      </VText>
    </group>
  );
}

/**
 * The exam room in VR: Bousla interviews you across the desk, life-size. Hold the trigger to talk; your words are
 * recognized on the headset when it can, otherwise recorded and turned into text by Tajriba. You check the text, then
 * send it — the same interview, timer, recording and teacher live-watch as the 2D exam room.
 */
export function ExamScene({ id }: { id: string }) {
  const t = useTranslations('campus');
  const tv = useTranslations('vr.exam');
  const { go } = useVRNav();
  const desktop = useDesktopView();
  const path = `/exam-attempts/${id}`;
  const q = useApi<AttemptView>(path);
  const invalidate = useInvalidate();
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const a = attempt ?? q.data ?? null;
  useEffect(() => {
    if (q.data) setAttempt(q.data);
  }, [q.data]);
  useSocketEvent<{ attemptId: string }>('exam:status', (d) => d.attemptId === id && void invalidate(path, '/exams/mine'));
  useSocketEvent<{ attemptId: string }>('exam:turn', (d) => d.attemptId === id && void invalidate(path));

  useEffect(() => desktop.look([SEAT.x, 1.75, SEAT.z + 1.2], [BOUSLA.x, 0.95, BOUSLA.z]), [desktop]);

  const running = a?.status === 'IN_PROGRESS';
  const room = useRoom(a ? a.room : null);
  const voice = useVoice({ room: a?.room ?? null, selfId: a?.studentId ?? null, publishes: room.publishes, peers: room.players, joined: room.status === 'joined' });
  const rec = useRecorder({ kind: 'EXAM', refId: id, stream: voice.stream, active: running });
  // mic on for the teacher's live listening and the recording (entering VR was the user's click)
  const { enable, enabled } = voice;
  useEffect(() => {
    if (running && room.status === 'joined' && room.publishes && !enabled) void enable(true);
  }, [running, room.status, room.publishes, enabled, enable]);

  const locale = a?.exam.locale ?? 'en';
  const stt = useSpeechToText(locale);
  const tts = useTextToSpeech(locale);
  const forceServer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stt') === 'server';
  const onDevice = stt.supported && !forceServer;
  const left = useCountdown(a?.endsAt);
  const observed = room.players.some((p) => p.spectator);
  const lastAi = a ? [...a.turns].reverse().find((x) => x.role === 'AI') : undefined;

  const [holding, setHolding] = useState(false);
  /** mirrors `holding` for async code; `talkId` tells an old press from the current one */
  const talking = useRef(false);
  const talkId = useRef(0);
  const ownStream = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');
  transcriptRef.current = stt.transcript;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'start' | 'listen' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const spoken = useRef(-1);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  // Bousla says each new question out loud (when the headset has a voice)
  const { speak } = tts;
  useEffect(() => {
    if (!running || !lastAi || lastAi.idx <= spoken.current) return;
    spoken.current = lastAi.idx;
    void speak(lastAi.text);
  }, [running, lastAi, speak]);

  const start = useCallback(async () => {
    setBusy('start');
    setError(null);
    try {
      setAttempt(await api<AttemptView>(`${path}/start`, { method: 'POST' }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tv('error'));
    } finally {
      setBusy(null);
    }
  }, [path, tv]);

  /** spoken audio → text through Tajriba (headsets without speech recognition) */
  const transcribe = useCallback(
    async (blob: Blob) => {
      setBusy('listen');
      setError(null);
      try {
        const form = new FormData();
        form.append('audio', blob, 'answer.webm');
        const r = await fetch(`/api${path}/transcribe`, { method: 'POST', body: form, credentials: 'include' });
        const body = (await r.json().catch(() => ({}))) as { text?: string; message?: string };
        if (!r.ok) throw new Error(body.message ?? tv('error'));
        setDraft((body.text ?? '').trim());
        if (!body.text?.trim()) setError(tv('heardNothing'));
      } catch (e) {
        setError(e instanceof Error ? e.message : tv('error'));
      } finally {
        setBusy(null);
      }
    },
    [path, tv],
  );

  const releaseOwnStream = () => {
    ownStream.current?.getTracks().forEach((tr) => tr.stop());
    ownStream.current = null;
  };

  /**
   * Start an answer. The audio is ALWAYS recorded too: on a headset whose speech recognition fails (network,
   * audio-capture…), the recording is turned into text by Tajriba instead of the answer being lost.
   */
  const startTalk = useCallback(async () => {
    const id = ++talkId.current;
    tts.cancel();
    setError(null);
    setDraft('');
    setHolding(true);
    talking.current = true;
    if (onDevice) {
      stt.reset();
      stt.start();
    }
    let stream = voice.stream;
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      ownStream.current = stream;
    }
    // stopped (or restarted) while the mic was being opened: don't leave a recorder running
    if (talkId.current !== id || !talking.current) {
      if (stream && stream === ownStream.current) releaseOwnStream();
      return;
    }
    if (!stream) {
      if (!onDevice) {
        talking.current = false;
        setHolding(false);
        setError(tv('noMic'));
      }
      return;
    }
    chunks.current = [];
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    mr.start();
    recorder.current = mr;
  }, [onDevice, stt, tts, voice.stream, tv]);

  /** Finish the answer: on-device text if there is any (final + the phrase still being recognized), else the recording. */
  const stopTalk = useCallback(async () => {
    talking.current = false;
    setHolding(false);
    const mr = recorder.current;
    recorder.current = null;
    const audio =
      mr && mr.state === 'recording'
        ? await new Promise<Blob>((resolve) => {
            mr.onstop = () => resolve(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }));
            mr.stop();
          })
        : null;
    releaseOwnStream();
    if (onDevice) {
      const finalText = stt.stop();
      const live = transcriptRef.current.trim();
      const text = (live.length > finalText.length ? live : finalText).trim();
      if (text) {
        setDraft(text);
        return;
      }
    }
    if (audio?.size) return transcribe(audio);
    setError(tv('heardNothing'));
  }, [onDevice, stt, transcribe, tv]);

  // leaving the room mid-answer: stop the recorder and any mic we opened
  useEffect(
    () => () => {
      talking.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      ownStream.current?.getTracks().forEach((tr) => tr.stop());
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setBusy('send');
      setError(null);
      try {
        const next = await api<AttemptView>(`${path}/answer`, { body: { text: text.trim() } });
        setDraft('');
        stt.reset();
        setAttempt(next);
        if (next.status !== 'IN_PROGRESS') {
          rec.stop();
          void invalidate('/exams/mine');
        }
      } catch (e) {
        setError(e instanceof ApiError && e.status !== 503 ? e.message : t('exam.retry'));
      } finally {
        setBusy(null);
      }
    },
    [path, stt, rec, invalidate, t],
  );

  // test hook (dev only)
  useEffect(() => {
    vrTest({ exam: { start, talk: startTalk, stopTalk, say: (text: string) => setDraft(text), send: () => send(draft), transcribe: (bytes: string) => transcribe(new Blob([bytes], { type: 'audio/webm' })), status: a?.status, question: a?.questionIdx, draft, onDevice } });
  }, [start, startTalk, stopTalk, send, transcribe, draft, a?.status, a?.questionIdx, onDevice]);
  useEffect(() => () => vrTestClear(['exam']), []);

  const mood: BouslaMood = busy === 'send' ? 'thinking' : holding ? 'curious' : BOUSLA_FOR[lastAi?.mood ?? 'calm'] ?? 'happy';
  const finished = a && ['GRADING', 'GRADED', 'RELEASED', 'MISSED'].includes(a.status);

  return (
    <>
      <XROrigin position={[SEAT.x, 0, SEAT.z + 0.35]} />
      <color attach="background" args={['#e3f2ff']} />
      <MapWorld map={MAP} skip={['bousla']} />
      {/* Bousla, life-size, behind the desk */}
      {/* life-size behind the desk, face at the student's eye line above the question card */}
      <Bousla3D mood={mood} scale={2.4} position={[BOUSLA.x, 1.2, BOUSLA.z]} needleAngle={holding ? 0 : null} />
      {lastAi?.emoji && running && <EmojiSprite emoji={lastAi.emoji} size={0.4} position={[BOUSLA.x + 0.75, 2.2, BOUSLA.z]} />}

      {/* a lectern-like card below eye level, so Bousla stays in full view across the desk */}
      <Panel width={1.25} height={0.62} position={[SEAT.x, 1.02, SEAT.z - 0.95]} rotation={[-0.42, 0, 0]}>
        {!a ? (
          <VText size={0.05}>{tv('loading')}</VText>
        ) : a.status === 'NOT_STARTED' ? (
          <>
            <VText size={0.06} bold position={[0, 0.17, 0]} maxWidth={1.15}>
              {a.exam.title}
            </VText>
            <VText size={0.038} position={[0, 0.06, 0]} maxWidth={1.15}>
              {tv('intro', { n: a.questionCount, min: a.exam.durationMin })}
            </VText>
            <VText size={0.032} color="#5b5675" position={[0, -0.04, 0]} maxWidth={1.15}>
              {tv('recorded')}
            </VText>
            <VButton label={tv('start')} onClick={() => void start()} disabled={busy === 'start'} position={[0, -0.19, 0]} width={0.5} name="vr-exam-start" />
          </>
        ) : finished ? (
          <>
            <VText size={0.06} bold position={[0, 0.12, 0]}>
              {tv('doneTitle')}
            </VText>
            <VText size={0.04} position={[0, 0.02, 0]} maxWidth={1.1}>
              {a.status === 'RELEASED' && a.result?.score != null ? t('exams.score', { score: a.result.score }) : tv('doneBody')}
            </VText>
            <VButton label={tv('home')} onClick={() => go({ kind: 'hub' })} position={[0, -0.16, 0]} width={0.5} name="vr-exam-home" />
          </>
        ) : (
          <>
            <VText size={0.03} bold color={VC.violet} anchorX="left" position={[-0.58, 0.26, 0]}>
              {t('exam.question', { n: Math.min(a.questionIdx + 1, a.questionCount), total: a.questionCount })}
            </VText>
            {left !== null && (
              <VText size={0.034} bold color={left < 60 ? VC.coral : VC.sky} anchorX="right" position={[0.58, 0.26, 0]}>
                {mmss(left)}
              </VText>
            )}
            <VText size={0.045} bold maxWidth={1.15} position={[0, 0.13, 0]}>
              {busy === 'send' ? tv('thinking') : lastAi?.text ?? ''}
            </VText>
            {draft ? (
              <>
                <VText size={0.034} color="#3b3561" maxWidth={1.15} position={[0, -0.05, 0]}>
                  {tv('youSaid', { text: draft })}
                </VText>
                <VButton label={tv('send')} onClick={() => void send(draft)} disabled={busy !== null} position={[-0.18, -0.21, 0]} width={0.32} color={VC.mint} textColor={VC.ink} name="vr-exam-send" />
                <VButton label={tv('again')} onClick={() => setDraft('')} disabled={busy !== null} position={[0.18, -0.21, 0]} width={0.32} color="#d9d4f0" textColor={VC.ink} />
              </>
            ) : (
              <>
                <VText size={0.03} color="#5b5675" maxWidth={1.15} position={[0, -0.06, 0]}>
                  {busy === 'listen' ? tv('listening') : holding ? (stt.transcript || tv('talking')) : onDevice ? tv('holdHint') : tv('holdHintServer')}
                </VText>
                <TalkButton label={holding ? tv('release') : tv('hold')} onToggle={() => void (holding ? stopTalk() : startTalk())} active={holding} disabled={busy !== null} position={[0, -0.2, 0]} />
              </>
            )}
          </>
        )}
        {error && (
          <VText size={0.03} color={VC.coral} maxWidth={1.15} position={[0, -0.28, 0]}>
            {error}
          </VText>
        )}
      </Panel>
      {observed && running && (
        <Panel width={0.6} height={0.09} position={[SEAT.x, 1.42, SEAT.z - 1.05]} rotation={[-0.3, 0, 0]} color={VC.violet}>
          <VText size={0.032} bold color={VC.white}>
            {t('exam.observed')}
          </VText>
        </Panel>
      )}
    </>
  );
}
