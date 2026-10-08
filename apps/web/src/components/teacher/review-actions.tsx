'use client';

import { CheckCircle2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { Slider } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Submission } from '@/lib/types';
import { errMessage, scoreTone } from './helpers';
import { toast } from './toast';

/** Teacher score + comment → validate (≥70) or ask to retry (<70). */
export function ReviewActions({ s, onDone }: { s: Submission; onDone: (updated: Submission) => void }) {
  const t = useTranslations('teacher.review');
  const initial = s.teacherReview?.score ?? s.finalScore ?? s.effectiveAiScore ?? s.aiCheck?.score ?? 70;
  const [score, setScore] = useState(Math.round(initial));
  const [comment, setComment] = useState(s.teacherReview?.comment ?? '');
  const [busy, setBusy] = useState<'ok' | 'retry' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = s.student?.name.split(' ')[0] ?? '';
  const passes = score >= 70;
  const override = s.status !== 'TEACHER_REVIEW';

  const send = async (kind: 'ok' | 'retry') => {
    setBusy(kind);
    setError(null);
    try {
      const updated = await api<Submission>(`/submissions/${s.id}/teacher-review`, { body: { score, comment: comment.trim() || undefined } });
      toast(kind === 'ok' ? t('validatedToast', { name: first }) : t('retryToast', { name: first }));
      onDone(updated);
    } catch (e) {
      setError(errMessage(e, t('error')));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4" data-testid="review-actions">
      {override && <p className="rounded-[12px] bg-muted px-3 py-2 text-sm text-muted-foreground">{t('overrideNote')}</p>}
      <div>
        <div className="mb-1 flex items-end justify-between">
          <Label className="mb-0">{t('yourScore')}</Label>
          <span className={cn('text-3xl font-extrabold tabular-nums', scoreTone(score))} data-testid="teacher-score-value">
            {score}
          </span>
        </div>
        <Slider value={[score]} min={0} max={100} step={1} onValueChange={([v]) => setScore(v)} aria-label={t('yourScore')} data-testid="teacher-score" />
        <p className="mt-1 text-xs text-muted-foreground">{passes ? t('passHint', { name: first }) : t('retryHint', { name: first })}</p>
      </div>
      <div>
        <Label htmlFor="teacher-comment">
          {t('comment')} <span className="font-normal text-muted-foreground">· {t('optional')}</span>
        </Label>
        <Textarea
          id="teacher-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          placeholder={t('commentPlaceholder', { name: first })}
          className="min-h-20 text-sm"
          data-testid="teacher-comment"
        />
      </div>
      {error && (
        <p className="rounded-[12px] bg-coral-soft px-3 py-2 text-sm font-bold text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={() => send('retry')} disabled={passes || !!busy} loading={busy === 'retry'} data-testid="teacher-retry">
          <RotateCcw /> {t('askRetry')}
        </Button>
        <Button variant="mint" onClick={() => send('ok')} disabled={!passes || !!busy} loading={busy === 'ok'} data-testid="teacher-approve">
          <CheckCircle2 /> {t('validate')}
        </Button>
      </div>
    </div>
  );
}
