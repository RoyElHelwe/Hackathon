'use client';

import { ArrowLeft, CheckCircle2, Headphones, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { CampusCanvas } from '@/components/campus/campus-canvas';
import { AttemptStatusBadge } from '@/components/campus/exam-status';
import { SessionReplay } from '@/components/campus/session-replay';
import { mmss, useCountdown } from '@/components/campus/use-countdown';
import { toast } from '@/components/teacher/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import type { AttemptView, ExamTurn } from '@/lib/campus/types';
import { useRoom, useSocketEvent } from '@/lib/campus/use-room';
import { useVoice } from '@/lib/campus/use-voice';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useMe } from '@/lib/hooks';

export default function AttemptPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('campus.teacher');
  const path = `/exam-attempts/${id}`;
  const q = useApi<AttemptView>(path, { refetchInterval: (s) => (s.state.data?.status === 'GRADING' ? 2500 : false) });
  const invalidate = useInvalidate();
  useSocketEvent<{ attemptId: string }>('exam:status', (d) => d.attemptId === id && void invalidate(path));
  useSocketEvent<{ attemptId: string }>('exam:turn', (d) => d.attemptId === id && void invalidate(path));

  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const a = q.data;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/teacher/exams/${a.examId}`}>
          <ArrowLeft className="rtl-flip" /> {t('live.back')}
        </Link>
      </Button>
      <PageHeader
        title={a.studentName ?? ''}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {a.exam.title} <AttemptStatusBadge status={a.status} />
          </span>
        }
      />
      {a.status === 'IN_PROGRESS' ? <LiveView attempt={a} /> : <Review attempt={a} onSaved={() => invalidate(path, `/exams/${a.examId}`)} />}
    </div>
  );
}

function Turns({ turns, live }: { turns: ExamTurn[]; live?: string }) {
  const t = useTranslations('campus');
  return (
    <ol className="space-y-2" data-testid="teacher-transcript">
      {turns.map((turn) => (
        <li key={turn.idx} className={cn('rounded-[14px] p-3 text-sm', turn.role === 'AI' ? 'bg-violet-soft' : 'border border-border bg-card')}>
          <div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase opacity-70">
            {turn.role === 'AI' ? `${turn.emoji ?? '🧭'} ${t('exam.bousla')}` : `🗣️ ${t('teacher.live.student')}`}
            {turn.questionId && <span>· {turn.questionId}</span>}
            {turn.role === 'STUDENT' && turn.mood && <span>· {turn.mood}</span>}
            {turn.eval && (
              <span className={cn('ms-auto rounded-full px-2 py-0.5 text-[11px] normal-case', turn.eval.score >= 7 ? 'bg-mint-soft text-success' : turn.eval.score >= 4 ? 'bg-sunny-soft text-warning' : 'bg-coral-soft text-danger')}>
                {t('teacher.live.turnScore', { score: turn.eval.score })}
              </span>
            )}
          </div>
          <p>{turn.text}</p>
          {turn.eval?.notes && <p className="mt-1 text-xs italic text-muted-foreground">{turn.eval.notes}</p>}
        </li>
      ))}
      {live && (
        <li className="rounded-[14px] border-2 border-dashed border-mint p-3 text-sm italic" data-testid="live-transcript">
          🎙️ {live}
        </li>
      )}
    </ol>
  );
}

function LiveView({ attempt }: { attempt: AttemptView }) {
  const t = useTranslations('campus.teacher.live');
  const { data: me } = useMe();
  const room = useRoom(attempt.room, { spectate: true });
  const voice = useVoice({ room: attempt.room, selfId: me?.user.id ?? null, publishes: false, peers: room.players, joined: room.status === 'joined' });
  const left = useCountdown(attempt.endsAt);
  const [live, setLive] = useState('');
  const studentSpeaking = room.players.some((p) => p.userId === attempt.studentId && p.speaking);

  useSocketEvent<{ room: string; text: string }>('exam:transcript', (d) => d.room === attempt.room && setLive(d.text));
  const turns = attempt.turns.length;
  useEffect(() => setLive(''), [turns]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">
        <p className="rounded-[12px] bg-violet-soft p-3 text-sm font-semibold" data-testid="spectating">
          👀 {t('watching')}
        </p>
        <CampusCanvas room={room} map="exam" interactive={false} className="aspect-[18/13] w-full" />
        <div className="flex flex-wrap items-center gap-2">
          {!voice.enabled ? (
            <Button onClick={() => voice.enable(false)} data-testid="listen-live">
              <Headphones /> {t('joinAudio')}
            </Button>
          ) : (
            <span className="flex items-center gap-2 text-sm font-bold text-success">
              <Headphones className="size-4" /> {t('audioOn')}
            </span>
          )}
          {studentSpeaking && <span className="text-sm font-bold text-mint">🎙️ {t('speakingNow')}</span>}
          {left !== null && <span className="ms-auto rounded-full bg-sky-soft px-3 py-1 font-mono text-sm font-bold text-sky">⏱ {mmss(left)}</span>}
        </div>
        <p className="text-xs text-muted-foreground">{t('hidden')}</p>
      </div>
      <Card className="max-h-[70vh] overflow-y-auto p-4">{attempt.turns.length ? <Turns turns={attempt.turns} live={live || undefined} /> : <p className="text-muted-foreground">{t('noTurns')}</p>}</Card>
    </div>
  );
}

function Review({ attempt, onSaved }: { attempt: AttemptView; onSaved: () => void }) {
  const t = useTranslations('campus.teacher.live');
  const r = attempt.result;
  const [score, setScore] = useState<string>(r?.teacherScore != null ? String(r.teacherScore) : '');
  const [comment, setComment] = useState(r?.teacherComment ?? '');
  const [busy, setBusy] = useState<'save' | 'release' | null>(null);

  if (attempt.status === 'GRADING') {
    return (
      <Card className="p-8">
        <Thinking label={t('grading')} />
      </Card>
    );
  }

  const save = async (release: boolean) => {
    setBusy(release ? 'release' : 'save');
    try {
      const n = score.trim() === '' ? undefined : Math.max(0, Math.min(100, Number(score)));
      await api(`/exam-attempts/${attempt.id}/review`, { body: { score: Number.isFinite(n) ? n : undefined, comment: comment.trim() || undefined, release } });
      toast(release ? t('approve') + ' ✓' : t('saveOnly') + ' ✓');
      onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const report = r?.report;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4">
        <Card className="space-y-3 p-5" data-testid="exam-review">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs font-bold text-muted-foreground">{t('aiScore')}</p>
              <p className="text-4xl font-extrabold">{r?.aiScore ?? '–'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">{t('finalScore')}</p>
              <p className="text-4xl font-extrabold text-primary">{r?.score ?? '–'}</p>
            </div>
            {attempt.status === 'RELEASED' && (
              <span className="flex items-center gap-1 text-sm font-bold text-success">
                <CheckCircle2 className="size-4" /> {t('releasedAt')}
              </span>
            )}
          </div>
          {report?.fallback && <p className="text-xs text-warning">{t('fallback')}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="score">{t('yourScore')}</Label>
              <Input id="score" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} placeholder={String(r?.aiScore ?? '')} data-testid="override-score" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comment">{t('comment')}</Label>
            <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(true)} loading={busy === 'release'} data-testid="approve-release">
              <CheckCircle2 /> {t('approve')}
            </Button>
            <Button variant="outline" onClick={() => save(false)} loading={busy === 'save'}>
              <Save /> {t('saveOnly')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('hidden')}</p>
        </Card>
        {report && (
          <Card className="space-y-3 p-5">
            <h3 className="text-lg font-extrabold">{t('report')}</h3>
            <p className="text-sm">
              <b>{t('notes')}:</b> {report.teacherNotes}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-bold text-success">{t('strengths')}</p>
                <ul className="list-disc ps-5 text-sm">{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div>
                <p className="font-bold text-warning">{t('gaps')}</p>
                <ul className="list-disc ps-5 text-sm">{report.gaps.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            </div>
            <div>
              <p className="font-bold">{t('perQuestion')}</p>
              <ul className="space-y-1 text-sm">
                {report.perQuestion.map((p) => {
                  const question = attempt.questions?.find((x) => x.id === p.questionId);
                  return (
                    <li key={p.questionId} className="flex gap-2">
                      <span className="w-14 shrink-0 font-bold">{p.score}/10</span>
                      <span>
                        <span className="text-muted-foreground">{question?.text ?? p.questionId}</span> — {p.comment}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        )}
        <SessionReplay kind="EXAM" refId={attempt.id} names={{}} showTimeline={false} />
      </div>
      <Card className="max-h-[80vh] overflow-y-auto p-4">
        <Turns turns={attempt.turns} />
      </Card>
    </div>
  );
}
