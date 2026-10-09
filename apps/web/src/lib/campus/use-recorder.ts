'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const TIMESLICE_MS = 10_000;

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

async function uploadChunk(id: string, seq: number, blob: Blob) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const form = new FormData();
    form.append('chunk', blob, `chunk-${seq}.webm`);
    try {
      const res = await fetch(`/api/recordings/${id}/chunks?seq=${seq}`, { method: 'POST', body: form, credentials: 'include', keepalive: blob.size < 60_000 });
      if (res.ok || res.status === 403 || res.status === 404 || res.status === 413) return;
    } catch {
      /* offline: retry */
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
}

/**
 * Records this participant's microphone for a study session / exam room and uploads it in ordered 10 s chunks
 * (the server concatenates them into one playable file). Uploads are queued so they never overlap or reorder.
 */
export function useRecorder(opts: { kind: 'STUDY' | 'EXAM'; refId: string | null; stream: MediaStream | null; active: boolean }) {
  const { kind, refId, stream, active } = opts;
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const recId = useRef<string | null>(null);
  const seq = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const stop = useCallback(() => {
    const r = mr.current;
    mr.current = null;
    if (r && r.state !== 'inactive') r.stop();
    setRecording(false);
  }, []);

  useEffect(() => {
    if (!active || !stream || !refId) return;
    const mime = pickMime();
    if (mime === null) {
      setError('unsupported');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { id } = await api<{ id: string }>('/recordings', { body: { kind, refId, mime: mime || 'audio/webm' } });
        if (cancelled) return;
        recId.current = id;
        seq.current = 0;
        const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24_000 });
        r.ondataavailable = (e) => {
          if (!e.data.size || !recId.current) return;
          const n = seq.current++;
          const rid = recId.current;
          queue.current = queue.current.then(() => uploadChunk(rid, n, e.data));
        };
        r.onstop = () => {
          const rid = recId.current;
          if (rid) queue.current = queue.current.then(() => api(`/recordings/${rid}/stop`, { method: 'POST' }).then(() => undefined).catch(() => undefined));
        };
        r.start(TIMESLICE_MS);
        mr.current = r;
        setRecording(true);
      } catch {
        if (!cancelled) setError('start_failed');
      }
    })();
    const onHide = () => mr.current?.requestData();
    window.addEventListener('pagehide', onHide);
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', onHide);
      stop();
    };
  }, [active, stream, refId, kind, stop]);

  return { recording, error, stop };
}
