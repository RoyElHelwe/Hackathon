'use client';

import { EMOTE_EMOJI, EMOTES, REACTIONS, type Emote } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { cn } from '@/lib/cn';

/** Emotes (keys 1–6) and quick emoji reactions shown above your avatar for everyone in the room. */
export function EmoteBar({ onEmote, onReaction, className, compact }: { onEmote: (e: Emote) => void; onReaction?: (emoji: string) => void; className?: string; compact?: boolean }) {
  const t = useTranslations('campus');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= EMOTES.length) onEmote(EMOTES[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEmote]);

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} data-testid="emote-bar">
      {EMOTES.map((e, i) => (
        <button
          key={e}
          type="button"
          onClick={() => onEmote(e)}
          className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-[14px] border-2 border-border bg-card px-2.5 text-xl shadow-[0_3px_0_0_var(--border)] transition-transform hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-none"
          title={`${t(`emotes.${e}`)} (${i + 1})`}
          aria-label={t(`emotes.${e}`)}
          data-testid={`emote-${e}`}
        >
          {EMOTE_EMOJI[e]}
          {!compact && <span className="hidden text-xs font-bold text-muted-foreground lg:inline">{t(`emotes.${e}`)}</span>}
        </button>
      ))}
      {onReaction &&
        REACTIONS.slice(0, compact ? 4 : REACTIONS.length).map((r) => (
          <button key={r} type="button" onClick={() => onReaction(r)} className="flex size-11 items-center justify-center rounded-full bg-muted text-xl transition-transform hover:scale-110 active:scale-90" aria-label={`${t('react')} ${r}`}>
            {r}
          </button>
        ))}
    </div>
  );
}
