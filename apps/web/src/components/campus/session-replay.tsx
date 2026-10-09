'use client';

import { EMOTE_EMOJI, type Emote } from '@tajriba/shared';
import { Mic } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { useApi } from '@/lib/hooks';
import type { RecordingItem, SessionEventItem } from '@/lib/campus/types';

const EVENT_ICON: Record<string, string> = {
  INVITED: '✉️',
  ACCEPTED: '🤝',
  JOIN: '🚪',
  REJOIN: '🔁',
  LEAVE: '👋',
  ENDED: '🏁',
  DECLINED: '🙅',
  CANCELLED: '🙅',
  SPECTATOR_JOINED: '👀',
  SPECTATOR_LEFT: '🙈',
  STARTED: '🎙️',
  FINISHED: '🏁',
  AI_TURN: '🧭',
  STUDENT_TURN: '🗣️',
};

/** Recordings (one per participant) + the recorded action timeline of a study session or exam room. */
export function SessionReplay({ kind, refId, events, names, showTimeline = true }: { kind: 'STUDY' | 'EXAM'; refId: string; events?: SessionEventItem[]; names: Record<string, string>; showTimeline?: boolean }) {
  const t = useTranslations('campus');
  const format = useFormatter();
  const recs = useApi<RecordingItem[]>(`/recordings?kind=${kind}&refId=${refId}`);
  const visible = (events ?? []).filter((e) => e.type !== 'AI_TURN' && e.type !== 'STUDENT_TURN');
  const start = events?.[0] ? new Date(events[0].at).getTime() : 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Mic className="size-5 text-primary" /> {t('study.recordings')}
        </h3>
        {!recs.data?.length ? (
          <p className="text-sm text-muted-foreground">{t('study.noRecordings')}</p>
        ) : (
          <ul className="space-y-3">
            {recs.data.map((r) => (
              <li key={r.id} className="space-y-1" data-testid="recording">
                <p className="text-sm font-bold">
                  {r.name} · <span className="font-normal text-muted-foreground">{format.dateTime(new Date(r.startedAt), { hour: '2-digit', minute: '2-digit' })} · {Math.max(1, Math.round(r.bytes / 1024))} KB</span>
                </p>
                <audio controls preload="none" src={`/api/recordings/${r.id}/audio`} className="w-full" />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {showTimeline && visible.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 font-display text-lg font-bold">{t('study.timeline')}</h3>
          <ol className="space-y-2" data-testid="timeline">
            {visible.map((e) => {
              const sec = Math.max(0, Math.round((new Date(e.at).getTime() - start) / 1000));
              const extra = e.type === 'EMOTE' ? ` ${EMOTE_EMOJI[(e.payload as { emote?: Emote }).emote ?? 'wave'] ?? ''}` : e.type === 'REACTION' ? ` ${String((e.payload as { emoji?: string }).emoji ?? '')}` : '';
              return (
                <li key={e.id} className="flex items-center gap-3 text-sm">
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`}</span>
                  <span aria-hidden>{EVENT_ICON[e.type] ?? (e.type === 'EMOTE' || e.type === 'REACTION' ? '✨' : '•')}</span>
                  <span>
                    {e.userId && names[e.userId] ? <b>{names[e.userId]} </b> : null}
                    {t.has(`events.${e.type}`) ? t(`events.${e.type}`) : e.type}
                    {extra}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
