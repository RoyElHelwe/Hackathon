'use client';

import { useTranslations } from 'next-intl';
import type { ExamTurn } from '@/lib/campus/types';
import { cn } from '@/lib/cn';

/** Staff view of an interview: every turn, the private per-answer score and notes, and the student's live speech. */
export function ExamTurns({ turns, live }: { turns: ExamTurn[]; live?: string }) {
  const t = useTranslations('campus');
  return (
    <ol className="space-y-2" data-testid="teacher-transcript">
      {turns.map((turn) => (
        <li key={turn.idx} className={cn('rounded-[16px] border-2 p-3 text-sm', turn.role === 'AI' ? 'border-cedar/25 bg-cedar-soft' : 'border-med/25 bg-med-soft')}>
          <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wider opacity-75">
            {turn.role === 'AI' ? `${turn.emoji ?? '🌲'} ${t('exam.arzino')}` : `🗣️ ${t('teacher.live.student')}`}
            {turn.questionId && <span>· {turn.questionId}</span>}
            {turn.role === 'STUDENT' && turn.mood && <span>· {turn.mood}</span>}
            {turn.eval && (
              <span className={cn('ms-auto rounded-full px-2 py-0.5 text-[11px] normal-case text-white', turn.eval.score >= 7 ? 'bg-cedar' : turn.eval.score >= 5 ? 'bg-med' : 'bg-flag')}>
                {t('teacher.live.turnScore', { score: turn.eval.score })}
              </span>
            )}
          </div>
          <p>{turn.text}</p>
          {turn.eval?.notes && <p className="mt-1 text-xs italic text-muted-foreground">{turn.eval.notes}</p>}
        </li>
      ))}
      {live && (
        <li className="rounded-[16px] border-2 border-dashed border-med p-3 text-sm italic" data-testid="live-transcript">
          🎙️ {live}
        </li>
      )}
    </ol>
  );
}
