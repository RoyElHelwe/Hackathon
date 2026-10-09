'use client';

import {
  ArrowLeft,
  CirclePlay,
  ClipboardList,
  ExternalLink,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Headphones,
  TriangleAlert,
  Type,
  Image as ImageIcon,
  Link2,
  Presentation,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { use, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { SubjectChip, subjectLabel } from '@/components/director/subject-chip';
import { errMessage } from '@/components/teacher/helpers';
import { ReconnectBanner } from '@/components/teacher/reconnect-banner';
import { toast } from '@/components/teacher/toast';
import type { ContentReportItem, CourseLesson, CourseSummary, LessonMaterial, LessonStatus, LessonSyncResult } from '@/components/teacher/types';
import { Arzino } from '@/components/arzino';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useApi, useInvalidate, useL } from '@/lib/hooks';

type AttachmentKind = 'pdf' | 'doc' | 'slides' | 'sheet' | 'video' | 'image' | 'link' | 'form' | 'file';

const ATTACHMENT_ICON: Record<AttachmentKind, LucideIcon> = {
  pdf: FileText,
  doc: FileText,
  slides: Presentation,
  sheet: FileSpreadsheet,
  video: CirclePlay,
  image: ImageIcon,
  link: Link2,
  form: ClipboardList,
  file: File,
};

function attachmentKind(m: LessonMaterial): AttachmentKind {
  if (m.type === 'youtube') return 'video';
  if (m.type === 'form') return 'form';
  if (m.type === 'link') return 'link';
  const mime = m.mimeType ?? '';
  if (mime === 'application/pdf') return 'pdf';
  if (/presentation|powerpoint/.test(mime)) return 'slides';
  if (/spreadsheet|excel/.test(mime)) return 'sheet';
  if (/document|msword|wordprocessing|text\//.test(mime)) return 'doc';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (/form/.test(mime)) return 'form';
  return 'file';
}

const STATUS_VARIANT: Record<LessonStatus, 'muted' | 'mint' | 'coral' | 'sunny'> = {
  NOT_GAMIFIED: 'muted',
  READY: 'mint',
  FAILED: 'coral',
  GAMIFYING: 'sunny',
};
const STATUS_KEY: Record<LessonStatus, string> = {
  NOT_GAMIFIED: 'statusNotGamified',
  READY: 'statusReady',
  FAILED: 'statusFailed',
  GAMIFYING: 'statusGamifying',
};

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('teacher.courses');
  const locale = useLocale();
  const invalidate = useInvalidate();
  const course = useApi<CourseSummary>(`/courses/${id}`);
  // Gamifying runs in the background on the server: poll every 3 s while any lesson is still being read.
  const lessons = useApi<CourseLesson[]>(`/courses/${id}/lessons`, {
    refetchInterval: (q) => (q.state.data?.some((l) => l.status === 'GAMIFYING') ? 3000 : false),
  });
  const [syncing, setSyncing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<CourseLesson | null>(null);

  // Tell the teacher when a background run finishes.
  const prevStatus = useRef<Map<string, LessonStatus> | null>(null);
  useEffect(() => {
    if (!lessons.data) return;
    const prev = prevStatus.current;
    for (const l of lessons.data) {
      if (prev?.get(l.id) !== 'GAMIFYING') continue;
      if (l.status === 'READY') toast(t('gamifyDone', { title: l.title }));
      if (l.status === 'FAILED') toast(t('gamifyFailed', { title: l.title }), 'error');
    }
    if (prev && lessons.data.some((l) => prev.get(l.id) === 'GAMIFYING' && l.status !== 'GAMIFYING')) void invalidate(`/courses/${id}`, '/courses');
    prevStatus.current = new Map(lessons.data.map((l) => [l.id, l.status]));
  }, [lessons.data, id, invalidate, t]);

  if (course.isLoading) return <PageSkeleton />;
  if (course.error || !course.data) return <ErrorState message={course.error?.message} onRetry={() => course.refetch()} />;
  const c = course.data;
  const title = t('title', { grade: c.gradeLevel, subject: subjectLabel(c.subject.name, locale) });

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api<LessonSyncResult>(`/courses/${id}/sync`, { method: 'POST' });
      if (r.reconnect) toast(t('syncReconnect'), 'error');
      else {
        const parts = [t('lessonCount', { n: r.lessons }), t('syncAdded', { n: r.added })];
        if (r.archived) parts.push(t('syncArchived', { n: r.archived }));
        toast(parts.join(' · '));
      }
    } catch (e) {
      toast(errMessage(e, t('syncError')), 'error');
    } finally {
      setSyncing(false);
      await invalidate(`/courses/${id}`, `/courses/${id}/lessons`, '/courses', '/classes');
    }
  };

  const gamify = async (lesson: CourseLesson) => {
    setConfirming(null);
    setStarting(lesson.id);
    try {
      await api(`/lessons/${lesson.id}/gamify`, { method: 'POST', body: {} });
      toast(t('gamifyStarted', { title: lesson.title }), 'info');
    } catch (e) {
      toast(errMessage(e, t('gamifyStartError')), 'error');
    } finally {
      setStarting(null);
      await lessons.refetch();
    }
  };
  // Regenerating replaces unapproved drafts: ask first when there are some.
  const onGamify = (lesson: CourseLesson) => (lesson.draftCount > 0 ? setConfirming(lesson) : void gamify(lesson));

  return (
    <div>
      <Link href="/teacher" className="mb-4 inline-flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-[0.09em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="rtl-flip size-4" /> {t('back')}
      </Link>
      <PageHeader
        mood="reading"
        eyebrow={t('eyebrow')}
        title={title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <SubjectChip name={c.subject.name} color={c.subject.color} locale={locale} />
            <span className="text-sm">{t('sectionCount', { n: c.sectionCount })}</span>
            {c.sections.map((s) => (
              <Link
                key={s.id}
                href={`/teacher/classes/${s.id}`}
                className="rounded-full border-2 border-border bg-card px-2.5 py-0.5 text-xs font-extrabold text-foreground hover:border-med/60"
                data-testid="course-section-chip"
              >
                {s.name}
              </Link>
            ))}
          </span>
        }
        actions={
          c.canEdit ? (
            <Button variant="outline" onClick={sync} disabled={syncing} data-testid="sync-lessons">
              <RefreshCw className={syncing ? 'animate-spin' : undefined} /> {syncing ? t('syncing') : t('syncCta')}
            </Button>
          ) : null
        }
      />
      {c.sections.some((s) => s.syncError === 'RECONNECT') && <ReconnectBanner />}

      <h2 className="mb-4 mt-2 font-display text-[22px] font-black">{t('lessonsTitle')}</h2>
      {lessons.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-[20px]" />
          ))}
        </div>
      ) : lessons.error ? (
        <ErrorState message={lessons.error.message} onRetry={() => lessons.refetch()} />
      ) : !lessons.data?.length ? (
        <div className="rounded-[20px] border-2 border-dashed border-med/40 bg-med-soft/40">
          <EmptyState mood="bored-waiting" title={t('emptyTitle')} body={t('emptyBody')} className="py-14" />
        </div>
      ) : (
        <ol className="space-y-3" data-testid="lesson-list">
          {lessons.data.map((l, i) => (
            <LessonRow key={l.id} lesson={l} index={i + 1} courseId={id} canEdit={c.canEdit} starting={starting === l.id} onGamify={onGamify} />
          ))}
        </ol>
      )}

      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent data-testid="regenerate-dialog">
          <DialogTitle>{t('regenerateTitle', { title: confirming?.title ?? '' })}</DialogTitle>
          <DialogDescription className="mt-2">{t('regenerateBody', { n: confirming?.draftCount ?? 0 })}</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="button" variant="kidMint" onClick={() => confirming && gamify(confirming)} data-testid="regenerate-confirm">
              <Wand2 /> {t('regenerateCta')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LessonRow({
  lesson,
  index,
  courseId,
  canEdit,
  starting,
  onGamify,
}: {
  lesson: CourseLesson;
  index: number;
  courseId: string;
  canEdit: boolean;
  starting: boolean;
  onGamify: (l: CourseLesson) => void;
}) {
  const t = useTranslations('teacher.courses');
  const locale = useLocale();
  const l = useL();
  const gamifying = lesson.status === 'GAMIFYING';
  const errorKey = ['AI_UNAVAILABLE', 'INTERRUPTED', 'FAILED'].includes(lesson.gamifyError ?? '') ? lesson.gamifyError! : 'FAILED';
  const url = lesson.sources.find((s) => s.classroomUrl)?.classroomUrl ?? null;
  const posted = new Date(lesson.postedAt).toLocaleDateString(locale === 'ar' ? 'ar-LB' : 'en-GB', { day: 'numeric', month: 'short' });
  return (
    <li data-testid="lesson-row">
      <Card className="flex gap-4 p-4 md:p-5">
        {gamifying ? (
          <Arzino mood="reading" size={52} className="-my-1 shrink-0" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-med font-display text-lg font-black tabular-nums text-white shadow-[0_3px_0_var(--med-d)]">
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-black leading-snug">{lesson.title || t('untitled')}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted-foreground">
                <span>{lesson.kind === 'ASSIGNMENT' ? t('kindAssignment') : t('kindMaterial')}</span>
                <span aria-hidden>·</span>
                <span>{t('postedOn', { date: posted })}</span>
                <span aria-hidden>·</span>
                <span>{t('postedIn', { n: lesson.sources.length })}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {lesson.status === 'READY' && lesson.contentChangedAt && <Badge variant="sunny">{t('changedRegenerate')}</Badge>}
              <Badge variant={STATUS_VARIANT[lesson.status]} data-testid="lesson-status">
                {gamifying && <Loader2 className="animate-spin" aria-hidden />}
                {t(STATUS_KEY[lesson.status])}
              </Badge>
              {canEdit && (
                <Button
                  size="sm"
                  variant={lesson.status === 'READY' ? 'outline' : 'kidMint'}
                  onClick={() => onGamify(lesson)}
                  disabled={gamifying || starting}
                  loading={starting}
                  data-testid="gamify-lesson"
                >
                  <Wand2 /> {lesson.status === 'READY' ? t('regenerateCta') : lesson.status === 'FAILED' ? t('retryCta') : t('gamifyCta')}
                </Button>
              )}
            </div>
          </div>
          {lesson.description && <p className="mt-2 line-clamp-2 text-sm font-semibold text-muted-foreground">{lesson.description}</p>}
          {lesson.status === 'FAILED' && (
            <p className="mt-2 rounded-[12px] border-2 border-flag/30 bg-flag-soft px-3 py-2 text-sm font-bold text-flag-d dark:text-danger" role="alert" data-testid="gamify-error">
              {t(`gamifyError.${errorKey}`)}
            </p>
          )}
          {lesson.topic && lesson.status !== 'GAMIFYING' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[14px] border-2 border-cedar/30 bg-cedar-soft px-3 py-2 text-sm" data-testid="lesson-skill">
              <Sparkles className="size-4 shrink-0 text-cedar" aria-hidden />
              <span className="font-extrabold text-cedar-ink dark:text-white">{t('skill', { name: l(lesson.topic.name) })}</span>
              {(lesson.draftCount > 0 || lesson.approvedCount > 0) && (
                <Link href={`/teacher/missions?courseId=${courseId}`} className="ms-auto font-display text-xs font-black uppercase tracking-[0.06em] text-med-d hover:underline dark:text-med" data-testid="lesson-missions-link">
                  {lesson.draftCount > 0 ? t('missionsToReview', { n: lesson.draftCount }) : t('missionsLive', { n: lesson.approvedCount })}
                </Link>
              )}
            </div>
          )}
          {lesson.contentReport && lesson.contentReport.length > 0 && !gamifying && <ContentReport items={lesson.contentReport} />}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {lesson.materials.map((m, i) => {
              const kind = attachmentKind(m);
              const Icon = ATTACHMENT_ICON[kind];
              return (
                <a
                  key={`${m.url}-${i}`}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border-2 border-border bg-card px-2.5 py-1 text-xs font-bold hover:border-med/60"
                  title={m.title}
                >
                  <Icon className="size-3.5 shrink-0 text-med" aria-hidden />
                  <span className="sr-only">{t(`attachment.${kind}`)}: </span>
                  <span className="truncate">{m.title}</span>
                </a>
              );
            })}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="ms-auto inline-flex items-center gap-1 text-xs font-extrabold text-med-d hover:underline dark:text-med"
                data-testid="open-in-classroom"
              >
                {t('openInClassroom')} <ExternalLink className="size-3.5 rtl-flip" />
              </a>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

/** Per attachment: what Arzino actually read on the last gamify run (watched the full video, read the document, title only…). */
function ContentReport({ items }: { items: ContentReportItem[] }) {
  const t = useTranslations('teacher.courses.contentReport');
  const reason = (item: ContentReportItem) => (item.codes?.length ? item.codes.map((c) => t(`code.${c}`)).join('; ') : (item.note ?? ''));
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('label')} data-testid="content-report">
      {items.map((item, i) => {
        const listened = item.type === 'audio' || item.codes?.includes('audio_only');
        const [variant, Icon, label]: ['mint' | 'sky' | 'muted' | 'coral', LucideIcon, string] =
          item.status === 'full'
            ? [listened ? 'sky' : 'mint', listened ? Headphones : Eye, listened ? t('audio') : t('full')]
            : item.status === 'text'
              ? ['mint', FileText, t('text')]
              : item.status === 'title'
                ? ['muted', Type, t('title')]
                : ['coral', TriangleAlert, t('failed', { note: reason(item) })];
        const extra = item.status === 'full' && item.codes?.includes('first_2h') ? ` · ${t('first2h')}` : '';
        const why = item.status === 'title' ? reason(item) : '';
        return (
          <li key={`${item.title}-${i}`}>
            <Badge variant={variant} className={`max-w-full ${item.status === 'failed' ? 'whitespace-normal' : ''}`} title={why ? `${item.title} — ${why}` : item.title} data-status={item.status}>
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="max-w-[12rem] truncate font-bold">{item.title}</span>
              <span aria-hidden>·</span>
              <span>
                {label}
                {extra}
              </span>
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
