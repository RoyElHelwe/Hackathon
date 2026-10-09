'use client';

import { Bot, CloudOff, MessageCircleQuestion, Quote, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { Submission } from '@/lib/types';
import { BAND_BAR, FLAG_VARIANT, KNOWN_FLAGS, STATUS_VARIANT, band, scoreTone } from './helpers';
import { PhotoGallery } from './photo-gallery';
import { ReviewActions } from './review-actions';
import { useRelativeTime } from './use-relative-time';

function Section({ title, icon: Icon, children, className }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="eyebrow mb-2 flex items-center gap-1.5">
        {Icon && <Icon className="size-4" />} {title}
      </h3>
      {children}
    </section>
  );
}

/** Side-by-side evidence (photos, explanation, numbers) and checks (AI, peer) + teacher actions. */
export function ReviewDetail({ s, onDone }: { s: Submission; onDone: (u: Submission) => void }) {
  const t = useTranslations('teacher.review');
  const tf = useTranslations('teacher.flags');
  const ts = useTranslations('common.status');
  const l = useL();
  const ago = useRelativeTime();
  const ai = s.aiCheck;
  const aiScore = s.effectiveAiScore ?? ai?.score ?? null;
  const fields = s.mission.proofSpec?.fields ?? [];
  const answers = Object.entries(s.answers ?? {});
  const flags = [...new Set(s.flags ?? [])];

  return (
    <Card className="overflow-hidden" data-testid="review-detail">
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-border p-5">
        <Avatar name={s.student?.name ?? '?'} src={s.student?.avatarUrl} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[22px] font-black leading-tight">{s.student?.name}</p>
          <p className="truncate text-sm font-semibold text-muted-foreground">
            {l(s.mission.title)}
            {s.mission.topic && ` · ${l(s.mission.topic.name)}`}
            {s.attempt > 1 && ` · ${t('attempt', { n: s.attempt })}`}
            {s.submittedAt && ` · ${ago(s.submittedAt)}`}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[s.status]}>{ts(s.status)}</Badge>
      </div>

      {(flags.length > 0 || s.gradeSyncPending) && (
        <div className="space-y-2 border-b-2 border-border bg-flame-soft/60 px-5 py-3">
          {flags.map((f) => (
            <p key={f} className="flex items-start gap-2 text-sm">
              <Badge variant={FLAG_VARIANT[f] ?? 'muted'} className="mt-0.5">
                {KNOWN_FLAGS.includes(f) ? tf(`${f}.label`) : f}
              </Badge>
              <span className="font-semibold text-muted-foreground">{KNOWN_FLAGS.includes(f) ? tf(`${f}.explain`) : ''}</span>
            </p>
          ))}
          {s.gradeSyncPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CloudOff className="size-4 text-flame" /> {t('syncPendingExplain')}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 p-5 md:grid-cols-2">
        {/* Evidence */}
        <div className="space-y-5">
          <Section title={t('photos')}>
            <PhotoGallery ids={s.photoUploadIds} />
          </Section>
          {answers.length > 0 && (
            <Section title={t('numbers')}>
              <dl className="grid grid-cols-2 gap-2">
                {answers.map(([k, v]) => {
                  const f = fields.find((x) => x.key === k);
                  return (
                    <div key={k} className="rounded-[14px] border-2 border-border px-3 py-2">
                      <dt className="text-xs font-bold text-muted-foreground">{f ? l(f.label) : k}</dt>
                      <dd className="font-display text-xl font-black tabular-nums">
                        {v}
                        {f?.unit ? ` ${f.unit}` : ''}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Section>
          )}
          <Section title={t('explanation')} icon={Quote}>
            {s.explanation ? (
              <blockquote className="rounded-[14px] border-s-4 border-med bg-muted px-4 py-3 text-[15px] font-semibold leading-relaxed">{s.explanation}</blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noExplanation')}</p>
            )}
          </Section>
          {ai?.followUpQuestion && (
            <Section title={t('followUp')} icon={MessageCircleQuestion}>
              <div className="space-y-2 text-sm">
                <div className="flex items-end gap-2">
                  <Arzino mood="starry-eyed" size={44} animate={false} />
                  <p className="flex-1 rounded-[14px] rounded-es-sm border-2 border-med/30 bg-med-soft px-3 py-2 font-bold">{ai.followUpQuestion}</p>
                </div>
                {s.followUpAnswer ? (
                  <p className="ms-12 rounded-[14px] rounded-ee-sm border-2 border-border px-3 py-2 font-semibold">{s.followUpAnswer}</p>
                ) : (
                  <p className="ms-12 text-muted-foreground">{t('noAnswer')}</p>
                )}
                {s.aiFollowUpCheck && (
                  <p className={cn('ms-12 text-xs font-extrabold', s.aiFollowUpCheck.understood ? 'text-cedar-d dark:text-success' : 'text-flame-d dark:text-warning')}>
                    {s.aiFollowUpCheck.understood ? t('understood') : t('notYetUnderstood')} · {s.aiFollowUpCheck.feedback}
                  </p>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* Checks + actions */}
        <div className="space-y-5">
          {ai && (
            <Section title={t('aiCheck')} icon={Bot}>
              <div className="rounded-[16px] border-2 border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground">{t('aiScore')}</span>
                  {aiScore !== null && <span className={cn('font-display text-[32px] font-black leading-none tabular-nums', scoreTone(aiScore))}>{aiScore}</span>}
                </div>
                <ul className="mt-3 space-y-2">
                  {ai.perCriterion.map((c) => (
                    <li key={c.criterion} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="font-bold">{c.criterion}</span>
                        <span className={cn('font-black tabular-nums', scoreTone(c.score))}>{c.score}</span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-lock">
                        <div className={cn('h-full rounded-full', BAND_BAR[band(c.score)])} style={{ width: `${c.score}%` }} />
                      </div>
                      {c.comment && <p className="mt-0.5 text-xs text-muted-foreground">{c.comment}</p>}
                    </li>
                  ))}
                </ul>
                {ai.feedback && <p className="mt-3 rounded-[12px] bg-muted px-3 py-2 text-sm font-semibold">{ai.feedback}</p>}
              </div>
            </Section>
          )}
          {s.peer && (
            <Section title={t('peer')} icon={UserCheck}>
              <div className="rounded-[16px] border-2 border-border p-4">
                <div className="flex items-center gap-2">
                  <Avatar name={s.peer.evaluatorFirstName} src={s.peer.evaluatorAvatarUrl} className="size-8 text-xs" />
                  <span className="flex-1 font-extrabold">{s.peer.evaluatorFirstName}</span>
                  {s.peer.score !== null ? (
                    <span className={cn('font-display text-[28px] font-black leading-none tabular-nums', scoreTone(s.peer.score))}>{s.peer.score}</span>
                  ) : (
                    <Badge variant="muted">{t('peerPending')}</Badge>
                  )}
                </div>
                {s.peer.comment && <p className="mt-2 text-sm">“{s.peer.comment}”</p>}
                {s.peer.checklist && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.peer.checklist.map((c) => (
                      <Badge key={c.criterion} variant={c.ok ? 'mint' : 'coral'}>
                        {c.ok ? '✓' : '✗'} {c.criterion}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}
          <div className="rounded-[18px] border-2 border-med/30 bg-med-soft/60 p-4">
            <ReviewActions key={s.id} s={s} onDone={onDone} />
          </div>
        </div>
      </div>
    </Card>
  );
}
