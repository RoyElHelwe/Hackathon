'use client';

import { Mic, Square } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

// The Web Speech API is not in TypeScript's DOM lib yet; minimal typings for what we use.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

const LANG: Record<string, string> = { ar: 'ar-LB', en: 'en-US', fr: 'fr-FR' };

/**
 * Mic button: live speech-to-text (Chrome Web Speech API) + records the audio with MediaRecorder
 * so it can be uploaded as evidence. Falls back to typing when unsupported.
 */
export function VoiceInput({ onTranscript, onAudio, className }: { onTranscript: (text: string, final: boolean) => void; onAudio?: (blob: Blob) => void; className?: string }) {
  const t = useTranslations('mission');
  const locale = useLocale();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const base = useRef('');

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return setSupported(false);
    const rec = new Ctor();
    rec.lang = LANG[locale] ?? 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    base.current = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) base.current += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      onTranscript((base.current + interim).trim(), !interim);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
    if (onAudio && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        chunks.current = [];
        mr.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
        mr.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop());
          if (chunks.current.length) onAudio(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }));
        };
        mr.start();
        mediaRef.current = mr;
      } catch {
        /* mic permission denied: transcript only */
      }
    }
  }, [locale, onAudio, onTranscript]);

  useEffect(() => () => stop(), [stop]);

  if (!supported) return <p className={cn('text-xs text-muted-foreground', className)}>{t('voiceUnsupported')}</p>;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        onClick={listening ? stop : start}
        className={cn('kid-press flex h-14 items-center gap-2 rounded-full px-5 font-display text-lg font-bold text-white', listening ? 'bg-coral [--press:#d65a3b]' : 'bg-primary')}
        aria-pressed={listening}
        data-testid="mic-button"
      >
        {listening ? <Square className="size-5" /> : <Mic className="size-6" />}
        {listening ? t('stopSpeaking') : t('speak')}
      </button>
      {listening && (
        <span className="flex items-center gap-2 text-sm font-semibold text-coral" aria-live="polite">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-coral" />
          </span>
          {t('listening')}
        </span>
      )}
    </div>
  );
}
