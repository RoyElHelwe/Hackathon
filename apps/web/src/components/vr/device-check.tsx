'use client';

import { useFrame } from '@react-three/fiber';
import { XROrigin } from '@react-three/xr';
import { CheckCircle2, Glasses, Mic, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mesh } from 'three';
import { Arzino } from '@/components/arzino';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { Bousla3D } from './bousla-3d';
import { Panel, VC, VText } from './kit';
import { XRStage, useVRStore, useVRSupported } from './stage';

type Status = boolean | null;
interface Checks {
  secure: Status;
  webxr: Status;
  vr: Status;
  ar: Status;
  webgl2: Status;
  stt: Status;
  tts: Status;
  mic: Status;
}

type XRNav = Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } };

function SpinningCube() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt;
  });
  return (
    <mesh ref={ref} position={[0.55, 1.3, -1.4]} castShadow>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color={VC.mint} />
    </mesh>
  );
}

/**
 * /vr/check — open this first on the Quest (no cable needed). Every row should be green; the voice rows say how the
 * VR exam will take spoken answers on this device.
 */
export default function DeviceCheck() {
  const t = useTranslations('vr.check');
  const store = useVRStore();
  const [c, setC] = useState<Checks>({ secure: null, webxr: null, vr: null, ar: null, webgl2: null, stt: null, tts: null, mic: null });
  const [voices, setVoices] = useState(0);
  const [inVR, setInVR] = useState(false);
  const [ua, setUa] = useState('');
  const support = useVRSupported(store);
  useEffect(() => setC((p) => ({ ...p, vr: support.vr, ar: support.ar, webxr: support.vr ? true : p.webxr })), [support.vr, support.ar]);

  useEffect(() => {
    const nav = navigator as XRNav;
    const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    // no probe canvas: a second GL context can knock out the 3D preview's (the preview itself proves WebGL works)
    const gl = typeof WebGL2RenderingContext !== 'undefined';
    setUa(navigator.userAgent);
    setC((p) => ({ ...p, secure: window.isSecureContext, webxr: !!nav.xr, webgl2: gl, stt: !!(w.SpeechRecognition || w.webkitSpeechRecognition), tts: 'speechSynthesis' in window ? null : false }));
    if ('speechSynthesis' in window) {
      // voices load asynchronously; Arzino can speak only if there is at least one
      const read = () => {
        const n = window.speechSynthesis.getVoices().length;
        setVoices(n);
        if (n) setC((p) => ({ ...p, tts: true }));
      };
      read();
      const giveUp = window.setTimeout(() => setC((p) => (p.tts === null ? { ...p, tts: false } : p)), 2500);
      window.speechSynthesis.addEventListener?.('voiceschanged', read);
      return () => {
        window.clearTimeout(giveUp);
        window.speechSynthesis.removeEventListener?.('voiceschanged', read);
      };
    }
  }, []);

  const testMic = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((tr) => tr.stop());
      setC((p) => ({ ...p, mic: true }));
    } catch {
      setC((p) => ({ ...p, mic: false }));
    }
  }, []);

  const rows: { key: keyof Checks; label: string; hint: string; optional?: boolean }[] = [
    { key: 'secure', label: t('secure'), hint: t('secureHint') },
    { key: 'webxr', label: t('webxr'), hint: t('webxrHint') },
    { key: 'vr', label: t('vr'), hint: t('vrHint') },
    { key: 'webgl2', label: t('webgl2'), hint: t('webgl2Hint') },
    { key: 'mic', label: t('mic'), hint: t('micHint') },
    { key: 'stt', label: t('stt'), hint: t('sttHint'), optional: true },
    { key: 'tts', label: t('tts', { n: voices }), hint: t('ttsHint'), optional: true },
    { key: 'ar', label: t('ar'), hint: t('arHint'), optional: true },
  ];
  const ready = !!(c.secure && c.webxr && c.vr && c.webgl2);
  const isQuest = /OculusBrowser|Quest/i.test(ua);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4" data-testid="vr-check">
      <header className="flex items-center gap-3">
        <Arzino mood={ready ? 'cheering' : 'curious'} size={64} />
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{isQuest ? t('onQuest') : t('notQuest')}</p>
        </div>
      </header>

      <Card className={cn('p-4 font-display text-lg font-bold', ready ? 'border-mint bg-mint-soft' : 'border-coral bg-coral-soft')} data-testid="vr-ready">
        {ready ? t('ready') : t('notReady')}
        <p className="mt-1 font-sans text-sm font-semibold text-muted-foreground">{c.stt ? t('voiceDevice') : t('voiceServer')}</p>
      </Card>

      <ul className="space-y-2">
        {rows.map((r) => {
          const v = c[r.key];
          return (
            <li key={r.key} className="flex items-start gap-3 rounded-[14px] border border-border bg-card p-3" data-testid={`check-${r.key}`} data-ok={v === null ? 'unknown' : String(v)}>
              {v === null ? (
                <span className="mt-0.5 size-5 shrink-0 animate-pulse rounded-full bg-muted" />
              ) : v ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              ) : (
                <XCircle className={cn('mt-0.5 size-5 shrink-0', r.optional ? 'text-sunny' : 'text-danger')} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{r.label}</p>
                {v === false && <p className="text-sm text-muted-foreground">{r.hint}</p>}
              </div>
              {r.key === 'mic' && v !== true && (
                <Button size="sm" variant="kidGhost" onClick={testMic} data-testid="test-mic">
                  <Mic /> {t('testMic')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="relative h-72 overflow-hidden rounded-[20px] border-2 border-border">
        <XRStage store={store} onSession={setInVR}>
          <XROrigin position={[0, 0, 0]} />
          <directionalLight position={[2, 4, 2]} intensity={1.3} castShadow />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[4, 32]} />
            <meshStandardMaterial color="#e9fbf4" />
          </mesh>
          <Bousla3D mood={inVR ? 'cheering' : 'happy'} position={[0, 1.25, -1.5]} />
          <SpinningCube />
          <Panel width={0.9} height={0.22} position={[0, 1.85, -1.6]}>
            <VText size={0.05} bold maxWidth={0.84}>
              {inVR ? t('itWorks') : t('hello')}
            </VText>
          </Panel>
        </XRStage>
        {c.vr && !inVR && (
          <Button variant="kid" className="absolute bottom-3 end-3" onClick={() => void store.enterVR()} data-testid="enter-vr-test">
            <Glasses /> {t('enterTest')}
          </Button>
        )}
      </div>

      <p className="break-all text-xs text-muted-foreground" data-testid="vr-ua">
        {ua}
      </p>
      <Button asChild variant="outline">
        <Link href="/vr">{t('next')}</Link>
      </Button>
    </div>
  );
}
