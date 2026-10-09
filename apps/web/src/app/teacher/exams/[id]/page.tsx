'use client';

import type { ExamQuestion } from '@tajriba/shared';
import { Eye, Plus, RefreshCw, Rocket, Save, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { AttemptStatusBadge, ExamStatusBadge } from '@/components/campus/exam-status';
import { mmss } from '@/components/campus/use-countdown';
import { toast } from '@/components/teacher/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import type { ExamDetail } from '@/lib/campus/types';
import { useSocketEvent } from '@/lib/campus/use-room';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate } from '@/lib/hooks';

export default function TeacherExamPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('campus.teacher');
  const format = useFormatter();
  const path = `/exams/${id}`;
  const exam = useApi<ExamDetail>(path, {
    refetchInterval: (q) => (q.state.data?.status === 'PREPARING' ? 2500 : q.state.data?.status === 'OPEN' ? 4000 : false),
  });
  const invalidate = useInvalidate();
  useSocketEvent<{ examId: string }>('exam:graded', (d) => d.examId === id && void invalidate(path));
  const [publishOpen, setPublishOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(iv);
  }, []);

  if (exam.isLoading) return <PageSkeleton />;
  if (exam.error || !exam.data) return <ErrorState onRetry={() => exam.refetch()} />;
  const e = exam.data;
  const when = (d: string) => format.dateTime(new Date(d), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      await invalidate(path, '/exams');
      if (ok) toast(ok);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const graded = e.attempts?.filter((a) => a.status === 'GRADED').length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={e.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {e.className} · {e.durationMin} min · {t('detail.window', { opens: when(e.opensAt), closes: when(e.closesAt) })}
            <ExamStatusBadge status={e.status} />
          </span>
        }
        actions={
          graded > 0 ? (
            <Button onClick={() => act('release', () => api(`${path}/release-all`, { method: 'POST' }), t('detail.released', { n: graded }))} loading={busy === 'release'} data-testid="release-all">
              {t('detail.releaseAll', { n: graded })}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold text-muted-foreground">{t('detail.lessonsUsed')}:</span>
        {e.lessons.map((l) => (
          <Badge key={l.id} variant="outline">
            {l.title}
          </Badge>
        ))}
      </div>

      {e.status === 'PREPARING' && (
        <Card className="p-8">
          <Thinking label={t('detail.preparing')} />
        </Card>
      )}

      {e.status === 'FAILED' && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="font-semibold text-danger">{t('detail.failed')}</p>
          <Button onClick={() => act('prepare', () => api(`${path}/prepare`, { method: 'POST' }))} loading={busy === 'prepare'}>
            <RefreshCw /> {t('detail.retry')}
          </Button>
        </Card>
      )}

      {e.canEdit && e.questions && e.questions.length > 0 && (
        <QuestionEditor
          key={JSON.stringify(e.questions)}
          questions={e.questions}
          busy={busy}
          onSave={(questions) => act('save', () => api(path, { method: 'PATCH', body: { questions } }), t('detail.saved'))}
          onRegenerate={() => act('prepare', () => api(`${path}/prepare`, { method: 'POST' }))}
          onPublish={e.status === 'READY' ? () => setPublishOpen(true) : undefined}
        />
      )}

      {!!e.attempts?.length && (
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold">{t('detail.rooms')}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="room-grid">
            {e.attempts.map((a) => {
              const left = a.status === 'IN_PROGRESS' && a.endsAt ? Math.max(0, Math.round((new Date(a.endsAt).getTime() - Date.now()) / 1000)) : null;
              return (
                <li key={a.id}>
                  <Card className={cn('flex h-full flex-col gap-2 p-4', a.status === 'IN_PROGRESS' && 'border-sky', a.status === 'GRADED' && 'border-primary')} data-testid={`room-${a.student.name.split(' ')[0].toLowerCase()}`}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar name={a.student.name} src={a.student.avatarUrl} className="size-10" />
                        {a.online && <span className="absolute -bottom-0.5 -end-0.5 size-3.5 rounded-full border-2 border-card bg-mint" title={t('detail.online')} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{a.student.name}</p>
                        <p className="text-xs text-muted-foreground">#{a.roomIndex}</p>
                      </div>
                      {a.lastEmoji && a.status === 'IN_PROGRESS' && <span className="text-3xl" title={a.lastMood ?? ''}>{a.lastEmoji}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AttemptStatusBadge status={a.status} />
                      {a.status === 'IN_PROGRESS' && (
                        <>
                          <span className="text-xs font-bold">Q{a.questionIdx + 1}/{e.questions?.length ?? '?'}</span>
                          {left !== null && <span className="font-mono text-xs font-bold text-sky">⏱ {mmss(left)}</span>}
                        </>
                      )}
                      {a.spectators > 0 && <span className="text-xs text-muted-foreground">👀 {t('detail.watchers', { n: a.spectators })}</span>}
                      {a.score != null && <span className="ms-auto text-lg font-extrabold">{a.score}/100</span>}
                    </div>
                    <div className="mt-auto pt-1">
                      {a.status === 'IN_PROGRESS' ? (
                        <Button asChild size="sm" variant="secondary" data-testid="watch-live">
                          <Link href={`/teacher/exams/attempts/${a.id}`}>
                            <Eye /> {t('detail.watch')}
                          </Link>
                        </Button>
                      ) : a.status === 'GRADED' || a.status === 'RELEASED' || a.status === 'GRADING' ? (
                        <Button asChild size="sm" variant={a.status === 'GRADED' ? 'default' : 'outline'} data-testid="review-attempt">
                          <Link href={`/teacher/exams/attempts/${a.id}`}>{t('detail.review')}</Link>
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogTitle>{t('detail.publishTitle')}</DialogTitle>
          <DialogDescription>{t('detail.publishBody', { opens: when(e.opensAt), closes: when(e.closesAt) })}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              ✕
            </Button>
            <Button
              onClick={() => act('publish', () => api(`${path}/publish`, { method: 'POST' }), t('detail.published')).then(() => setPublishOpen(false))}
              loading={busy === 'publish'}
              data-testid="confirm-publish"
            >
              <Rocket /> {t('detail.publish')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionEditor({ questions: initial, busy, onSave, onRegenerate, onPublish }: { questions: ExamQuestion[]; busy: string | null; onSave: (q: ExamQuestion[]) => void; onRegenerate: () => void; onPublish?: () => void }) {
  const t = useTranslations('campus.teacher.detail');
  const [qs, setQs] = useState(initial);
  const dirty = JSON.stringify(qs) !== JSON.stringify(initial);
  const set = (i: number, patch: Partial<ExamQuestion>) => setQs((list) => list.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">
          {t('questions')} <span className="text-muted-foreground">({qs.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRegenerate} loading={busy === 'prepare'}>
            <RefreshCw /> {t('regenerate')}
          </Button>
          <Button variant="secondary" onClick={() => onSave(qs)} disabled={!dirty} loading={busy === 'save'} data-testid="save-questions">
            <Save /> {t('save')}
          </Button>
          {onPublish && (
            <Button onClick={onPublish} disabled={dirty} data-testid="publish-exam">
              <Rocket /> {t('publish')}
            </Button>
          )}
        </div>
      </div>
      <ol className="space-y-3" data-testid="question-list">
        {qs.map((q, i) => (
          <li key={i}>
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-violet-soft text-sm font-black text-violet">{i + 1}</span>
                <Badge variant="muted">{q.difficulty}</Badge>
                <Button variant="ghost" size="sm" className="ms-auto" onClick={() => setQs((l) => l.filter((_, k) => k !== i))} disabled={qs.length <= 1} aria-label={t('remove')}>
                  <Trash2 />
                </Button>
              </div>
              <Textarea value={q.text} onChange={(e) => set(i, { text: e.target.value })} rows={2} aria-label={`${t('questions')} ${i + 1}`} />
              <Label className="text-xs text-muted-foreground">{t('expected')}</Label>
              <Input value={q.expectedPoints.join(' | ')} onChange={(e) => set(i, { expectedPoints: e.target.value.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 5).concat(e.target.value.trim() ? [] : ['…']) })} />
              <Label className="text-xs text-muted-foreground">{t('followUp')}</Label>
              <Input value={q.followUp ?? ''} onChange={(e) => set(i, { followUp: e.target.value })} />
            </Card>
          </li>
        ))}
      </ol>
      {qs.length < 15 && (
        <Button variant="ghost" onClick={() => setQs((l) => [...l, { id: `q${l.length + 1}`, text: '', expectedPoints: ['…'], difficulty: 'MEDIUM', followUp: '' }])}>
          <Plus /> {t('add')}
        </Button>
      )}
    </section>
  );
}
