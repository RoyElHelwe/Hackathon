'use client';

import { Sparkles, Users, Wand2, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { use, useCallback, useRef, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { BouslaSays } from '@/components/bousla';
import { errMessage } from '@/components/teacher/helpers';
import { MissionDraftCard } from '@/components/teacher/mission-draft-card';
import { MissionList } from '@/components/teacher/mission-list';
import { TopicPicker } from '@/components/teacher/topic-picker';
import type { Subject, TeacherDashboard } from '@/components/teacher/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useL } from '@/lib/hooks';
import type { ClassSummary, Mission } from '@/lib/types';

type Audience = 'STUDENT' | 'FAMILY';

export default function MissionStudioPage({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const sp = use(searchParams);
  const t = useTranslations('teacher.studio');
  const l = useL();
  const invalidate = useInvalidate();
  const classes = useApi<ClassSummary[]>('/classes');
  const subjects = useApi<Subject[]>('/subjects');

  const [pickedClass, setPickedClass] = useState<string | null>(sp.classId ?? null);
  const classId = pickedClass ?? classes.data?.[0]?.id ?? null;
  const cls = classes.data?.find((c) => c.id === classId);
  const dash = useApi<TeacherDashboard>(classId ? `/dashboards/teacher/${classId}` : null);

  const [pickedSubject, setPickedSubject] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>('STUDENT');
  const [interests, setInterests] = useState('');
  const [drafts, setDrafts] = useState<Mission[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const draftsRef = useRef<HTMLDivElement>(null);

  const subjectKey = pickedSubject ?? (dash.data?.topics.some((tp) => tp.subjectKey === 'math') ? 'math' : (dash.data?.topics[0]?.subjectKey ?? null));
  const topic = dash.data?.topics.find((tp) => tp.id === topicId);

  const onChange = useCallback((m: Mission) => setDrafts((ds) => ds.map((d) => (d.id === m.id ? m : d))), []);
  const onRemove = useCallback(
    (id: string) => {
      setDrafts((ds) => ds.filter((d) => d.id !== id));
      if (classId) void invalidate(`/missions?classId=${classId}`);
    },
    [classId, invalidate],
  );

  const generate = async () => {
    if (!classId || !topicId) return;
    setGenerating(true);
    setGenError(null);
    setDrafts([]);
    setTimeout(() => draftsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    try {
      const res = await api<Mission[]>('/missions/generate', {
        body: { topicId, classId, count: 3, audience, interests: interests.trim() || undefined },
      });
      setDrafts(res);
      await invalidate(`/missions?classId=${classId}`, '/classes');
    } catch (e) {
      setGenError(errMessage(e, t('generateError')));
    } finally {
      setGenerating(false);
    }
  };

  if (classes.isLoading) return <PageSkeleton />;
  if (classes.error) return <ErrorState message={classes.error.message} onRetry={() => classes.refetch()} />;
  if (!classes.data?.length) return <EmptyState title={t('noClasses')} body={t('noClassesBody')} mood="curious" />;

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <CardContent className="grid gap-6 p-5 md:p-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="studio-class">{t('class')}</Label>
                <Select
                  id="studio-class"
                  value={classId ?? ''}
                  onChange={(e) => {
                    setPickedClass(e.target.value);
                    setTopicId(null);
                    setDrafts([]);
                  }}
                  data-testid="studio-class-select"
                >
                  {classes.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('audience')}</Label>
                <div className="grid h-12 grid-cols-2 gap-1 rounded-[14px] bg-muted p-1" role="radiogroup" aria-label={t('audience')}>
                  {(['STUDENT', 'FAMILY'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={audience === a}
                      onClick={() => setAudience(a)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-[11px] text-sm font-bold transition-colors',
                        audience === a ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                      data-testid={`audience-${a.toLowerCase()}`}
                    >
                      {a === 'STUDENT' ? <User className="size-4" /> : <Users className="size-4" />}
                      {t(a === 'STUDENT' ? 'audienceStudent' : 'audienceFamily')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {dash.isLoading ? (
              <Skeleton className="h-32" />
            ) : dash.error ? (
              <ErrorState message={dash.error.message} onRetry={() => dash.refetch()} className="py-4" />
            ) : (
              dash.data &&
              subjects.data && (
                <TopicPicker
                  subjects={subjects.data}
                  dashboard={dash.data}
                  subjectKey={subjectKey}
                  topicId={topicId}
                  onSubject={(k) => {
                    setPickedSubject(k);
                    setTopicId(null);
                  }}
                  onTopic={setTopicId}
                />
              )
            )}
            <div>
              <Label htmlFor="interests">
                {t('interests')} <span className="font-normal text-muted-foreground">· {t('optional')}</span>
              </Label>
              <Input id="interests" value={interests} onChange={(e) => setInterests(e.target.value)} maxLength={200} placeholder={t('interestsPlaceholder')} data-testid="interests-input" />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-5 rounded-[18px] bg-gradient-to-b from-violet-soft to-transparent p-5">
            <BouslaSays mood={topic ? 'happy' : 'curious'} size={64}>
              <span className="text-sm">{topic ? t('bouslaReady', { topic: l(topic.name), className: cls?.name ?? '' }) : t('bouslaPick')}</span>
            </BouslaSays>
            <div className="space-y-2">
              <Button size="lg" className="w-full" onClick={generate} disabled={!topicId || generating} loading={generating} data-testid="generate-missions">
                <Wand2 /> {t('generate')}
              </Button>
              <p className="text-center text-xs text-muted-foreground">{t('privateNote')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div ref={draftsRef} className="scroll-mt-24">
        {generating && (
          <Card className="mt-6">
            <Thinking label={t('thinking')} />
            <div className="grid gap-3 px-6 pb-6 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </Card>
        )}
        {genError && (
          <Card className="mt-6">
            <ErrorState message={genError} onRetry={generate} />
          </Card>
        )}
        {!!drafts.length && (
          <section className="mt-8 space-y-5" data-testid="drafts">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-extrabold">
                  <Sparkles className="size-5 text-primary" /> {t('draftsTitle', { n: drafts.length })}
                </h2>
                <p className="text-sm text-muted-foreground">{t('draftsBody')}</p>
              </div>
            </div>
            {drafts.map((m, i) => (
              <MissionDraftCard
                key={m.id}
                mission={m}
                index={i}
                className={cls?.name ?? ''}
                classroomLinked={!!cls?.classroomCourseId}
                onChange={onChange}
                onRemove={onRemove}
              />
            ))}
          </section>
        )}
      </div>

      {classId && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{t('libraryTitle', { className: cls?.name ?? '' })}</CardTitle>
            <CardDescription>{t('libraryBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <MissionList
              classId={classId}
              editingIds={drafts.map((d) => d.id)}
              onOpen={(m) => {
                setDrafts((ds) => [...ds, m]);
                setTimeout(() => draftsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
