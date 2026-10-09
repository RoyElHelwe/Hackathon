'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from './socket';
import type { PlayerState } from './types';

type Signal = { type?: string; sdp?: string; candidate?: RTCIceCandidateInit | null };

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pending: RTCIceCandidateInit[];
  initiator: boolean;
}

let iceCache: RTCIceServer[] | null = null;
async function iceServers(): Promise<RTCIceServer[]> {
  if (iceCache) return iceCache;
  try {
    iceCache = (await api<{ iceServers: RTCIceServer[] }>('/realtime/ice')).iceServers;
  } catch {
    iceCache = [{ urls: 'stun:stun.l.google.com:19302' }];
  }
  return iceCache;
}

/** Who calls whom: the one with a mic calls spectators; between two speakers the smaller id calls (no glare). */
function shouldInitiate(me: { userId: string; publishes: boolean }, other: PlayerState): boolean {
  if (!me.publishes) return false;
  if (other.spectator) return true;
  return me.userId < other.userId;
}

/**
 * Small WebRTC mesh (2 students, or a student + watching teachers) with Socket.IO signaling.
 * Native RTCPeerConnection — no simple-peer (it needs Node polyfills in the browser).
 * Remote audio plays through <audio> elements whose volume follows distance in the room.
 */
export function useVoice(opts: { room: string | null; selfId: string | null; publishes: boolean; peers: PlayerState[]; joined: boolean }) {
  const { room, selfId, publishes, peers, joined } = opts;
  const [enabled, setEnabled] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [connected, setConnected] = useState<Record<string, RTCPeerConnectionState>>({});
  const peersRef = useRef(new Map<string, Peer>());
  const streamRef = useRef<MediaStream | null>(null);

  /** Must be called from a click (autoplay + mic permission). */
  const enable = useCallback(async (withMic = true) => {
    setError(null);
    if (publishes && withMic) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        streamRef.current = s;
        setStream(s);
      } catch {
        setError('mic_denied');
      }
    }
    setEnabled(true);
  }, [publishes]);

  const closePeer = useCallback((id: string) => {
    const p = peersRef.current.get(id);
    if (!p) return;
    p.pc.onicecandidate = null;
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    p.audio.srcObject = null;
    p.audio.remove();
    peersRef.current.delete(id);
    setConnected((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  }, []);

  const send = useCallback((to: string, signal: Signal) => {
    if (room) getSocket().emit('voice:signal', { room, to, signal });
  }, [room]);

  const makePeer = useCallback(async (id: string, initiator: boolean): Promise<Peer> => {
    const existing = peersRef.current.get(id);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: await iceServers() });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.dataset.peer = id;
    audio.style.display = 'none';
    document.body.appendChild(audio);
    const peer: Peer = { pc, audio, pending: [], initiator };
    peersRef.current.set(id, peer);
    const local = streamRef.current;
    if (local) for (const track of local.getTracks()) pc.addTrack(track, local);
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = (e) => {
      if (e.candidate) send(id, { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      void audio.play().catch(() => undefined);
    };
    pc.onconnectionstatechange = () => {
      setConnected((c) => ({ ...c, [id]: pc.connectionState }));
      if (pc.connectionState === 'failed') {
        // Start over: the caller re-offers.
        closePeer(id);
        if (initiator) void call(id);
      }
    };
    return peer;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `call` is defined below and stable for the same deps
  }, [send, closePeer]);

  const call = useCallback(async (id: string) => {
    const peer = await makePeer(id, true);
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    send(id, { type: offer.type, sdp: offer.sdp });
  }, [makePeer, send]);

  // Incoming signals.
  useEffect(() => {
    if (!room || !enabled) return;
    const s = getSocket();
    const onSignal = async (d: { room: string; from: string; signal: Signal }) => {
      if (d.room !== room) return;
      try {
        const { signal } = d;
        if (signal.type === 'offer') {
          const peer = peersRef.current.get(d.from) ?? (await makePeer(d.from, false));
          await peer.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
          for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => undefined);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          send(d.from, { type: answer.type, sdp: answer.sdp });
        } else if (signal.type === 'answer') {
          const peer = peersRef.current.get(d.from);
          if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
          await peer.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
          for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => undefined);
        } else if (signal.candidate) {
          const peer = peersRef.current.get(d.from);
          if (!peer) return;
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(signal.candidate).catch(() => undefined);
          else peer.pending.push(signal.candidate);
        }
      } catch {
        /* a broken negotiation is retried on connection failure */
      }
    };
    s.on('voice:signal', onSignal);
    return () => {
      s.off('voice:signal', onSignal);
    };
  }, [room, enabled, makePeer, send]);

  // Call new people / hang up on people who left.
  useEffect(() => {
    if (!enabled || !joined || !selfId) return;
    const present = new Set(peers.map((p) => p.userId));
    for (const id of [...peersRef.current.keys()]) if (!present.has(id)) closePeer(id);
    for (const p of peers) {
      if (peersRef.current.has(p.userId)) continue;
      if (!publishes && p.spectator) continue;
      if (shouldInitiate({ userId: selfId, publishes }, p)) void call(p.userId);
    }
  }, [peers, enabled, joined, selfId, publishes, call, closePeer]);

  // After a reconnect the server room is re-joined: renegotiate everything.
  useEffect(() => {
    if (!enabled) return;
    const s = getSocket();
    const onConnect = () => {
      for (const id of [...peersRef.current.keys()]) closePeer(id);
    };
    s.on('connect', onConnect);
    return () => {
      s.off('connect', onConnect);
    };
  }, [enabled, closePeer]);

  // Local speaking detection (level meter) → small "speaking" ring for others.
  useEffect(() => {
    if (!stream) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let last = false;
    let quietSince = 0;
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += (v - 128) * (v - 128);
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      const loud = rms > 6;
      if (loud) quietSince = now;
      const isSpeaking = loud || now - quietSince < 600;
      if (isSpeaking !== last) {
        last = isSpeaking;
        setSpeaking(isSpeaking);
      }
    }, 120);
    return () => {
      window.clearInterval(timer);
      void ctx.close().catch(() => undefined);
    };
  }, [stream]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      for (const id of [...peersRef.current.keys()]) closePeer(id);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [closePeer],
  );

  const toggleMic = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !s.getAudioTracks()[0]?.enabled;
    s.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, []);

  /** Proximity audio: 0..1 per remote user. */
  const setVolume = useCallback((id: string, v: number) => {
    const p = peersRef.current.get(id);
    if (p) p.audio.volume = Math.max(0, Math.min(1, v));
  }, []);

  return { enabled, enable, stream, micOn: micOn && !!stream, toggleMic, error, speaking: speaking && micOn, connected, setVolume };
}
