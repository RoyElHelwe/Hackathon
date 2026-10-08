'use client';

import {
  ArrowLeft,
  CirclePlay,
  ClipboardList,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Link2,
  Presentation,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { use, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { SubjectChip, subjectLabel } from '@/components/director/subject-chip';
import { errMessage } from '@/components/teacher/helpers';
import { ReconnectBanner } from '@/components/teacher/reconnect-banner';
import { toast } from '@/components/teacher/toast';
import type { CourseLesson, CourseSummary, LessonMaterial, LessonStatus, LessonSyncResult } from '@/components/teacher/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useApi, useInvalidate } from '@/lib/hooks';

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
  const lessons = useApi<CourseLesson[]>(`/courses/${id}/lessons`);
  const [syncing, setSyncing] = useState(false);

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

  return (
    <div>
      <Link href="/teacher" className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="rtl-flip size-4" /> {t('back')}
      </Link>
      <PageHeader
        title={title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <SubjectChip name={c.subject.name} color={c.subject.color} locale={locale} />
            <span className="text-sm">{t('sectionCount', { n: c.sectionCount })}</span>
            {c.sections.map((s) => (
              <Link
                key={s.id}
                href={`/teacher/classes/${s.id}`}
                className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-bold hover:border-primary/50"
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

      <h2 className="mb-3 mt-2 text-lg font-extrabold">{t('lessonsTitle')}</h2>
      {lessons.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-[20px]" />
          ))}
        </div>
      ) : lessons.error ? (
        <ErrorState message={lessons.error.message} onRetry={() => lessons.refetch()} />
      ) : !lessons.data?.length ? (
        <div className="rounded-[20px] border border-dashed border-border bg-card">
          <EmptyState mood="curious" title={t('emptyTitle')} body={t('emptyBody')} className="py-14" />
        </div>
      ) : (
        <ol className="space-y-3" data-testid="lesson-list">
          {lessons.data.map((l, i) => (
            <LessonRow key={l.id} lesson={l} index={i + 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function LessonRow({ lesson, index }: { lesson: CourseLesson; index: number }) {
  const t = useTranslations('teacher.courses');
  const locale = useLocale();
  const url = lesson.sources.find((s) => s.classroomUrl)?.classroomUrl ?? null;
  const posted = new Date(lesson.postedAt).toLocaleDateString(locale === 'ar' ? 'ar-LB' : 'en-GB', { day: 'numeric', month: 'short' });
  return (
    <li data-testid="lesson-row">
      <Card className="flex gap-4 p-4 md:p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-violet-soft text-sm font-extrabold tabular-nums text-primary dark:text-white">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-extrabold leading-snug">{lesson.title || t('untitled')}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{lesson.kind === 'ASSIGNMENT' ? t('kindAssignment') : t('kindMaterial')}</span>
                <span aria-hidden>·</span>
                <span>{t('postedOn', { date: posted })}</span>
                <span aria-hidden>·</span>
                <span>{t('postedIn', { n: lesson.sources.length })}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {lesson.status === 'READY' && lesson.contentChangedAt && <Badge variant="sunny">{t('changedInClassroom')}</Badge>}
              <Badge variant={STATUS_VARIANT[lesson.status]} data-testid="lesson-status">
                {t(STATUS_KEY[lesson.status])}
              </Badge>
            </div>
          </div>
          {lesson.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{lesson.description}</p>}
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
                  className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-bold hover:border-primary/50"
                  title={m.title}
                >
                  <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
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
                className="ms-auto inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
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
