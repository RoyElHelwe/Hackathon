'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

export const SPEECH_LANG: Record<string, string> = { ar: 'ar-LB', en: 'en-US', fr: 'fr-FR' };

function recognitionCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Live speech-to-text for spoken answers. Keeps listening across the browser's automatic pauses until `stop()`.
 * `transcript` = confirmed text + what is being said right now.
 */
export function useSpeechToText(locale: string) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const finalText = useRef('');
  const wanted = useRef(false);

  useEffect(() => setSupported(!!recognitionCtor()), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return false;
    }
    rec.current?.abort();
    const r = new Ctor();
    r.lang = SPEECH_LANG[locale] ?? 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText.current += res[0].transcript + ' ';
        else interim += res[0].transcript;
      }
      setTranscript((finalText.current + interim).trim());
    };
    // Chrome stops after silences; restart while the student still wants to talk (but never in a tight loop).
    let restarts: number[] = [];
    r.onend = () => {
      const now = Date.now();
      restarts = restarts.filter((x) => now - x < 3000);
      if (wanted.current && rec.current === r && restarts.length < 3) {
        restarts.push(now);
        try {
          r.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
    };
    r.onerror = (e) => {
      // "no-speech"/"aborted" just restart; anything else means voice typing can't work here → typed answers.
      if (e?.error && e.error !== 'no-speech' && e.error !== 'aborted') {
        wanted.current = false;
        setSupported(false);
      }
    };
    rec.current = r;
    wanted.current = true;
    try {
      r.start();
      setListening(true);
      return true;
    } catch {
      setListening(false);
      return false;
    }
  }, [locale]);

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
    setListening(false);
    return (finalText.current + '').trim();
  }, []);

  const reset = useCallback(() => {
    finalText.current = '';
    setTranscript('');
  }, []);

  /** Lets the typed fallback edit the same text. */
  const setText = useCallback((t: string) => {
    finalText.current = t ? `${t} ` : '';
    setTranscript(t);
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      rec.current?.abort();
    },
    [],
  );

  return { supported, listening, transcript, start, stop, reset, setText };
}

const EMOJI = /[\p{Extended_Pictographic}‍️]/gu;

/** Bousla's voice: browser speech synthesis in the exam language. Resolves when finished (or immediately if muted). */
export function useTextToSpeech(locale: string) {
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!supported || muted) return resolve();
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(EMOJI, '').trim());
        const lang = SPEECH_LANG[locale] ?? 'en-US';
        u.lang = lang;
        const voices = synth.getVoices();
        const voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
        if (voice) u.voice = voice;
        u.rate = 0.98;
        u.pitch = 1.08;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          setSpeaking(false);
          resolve();
        };
        u.onend = finish;
        u.onerror = finish;
        // Safety net: some browsers never fire onend.
        setTimeout(finish, Math.min(30_000, 2500 + text.length * 90));
        setSpeaking(true);
        synth.speak(u);
      }),
    [locale, muted, supported],
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => () => cancel(), [cancel]);

  return { supported, speaking, speak, cancel, muted, setMuted };
}
