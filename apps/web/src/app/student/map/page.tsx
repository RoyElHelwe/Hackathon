'use client';

import { ChevronRight, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { BouslaSays } from '@/components/bousla';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { SubjectIcon, TopicGlyph } from '@/components/app/subject-icon';
import { SkillMap } from '@/components/student/skill-map';
import { subjectStyle } from '@/components/student/subject-style';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogDescription, DialogTitle, SheetContent } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { useApi, useL } from '@/lib/hooks';
import type { ClassSummary, Graph, GraphNode } from '@/lib/types';
import type { I18nText } from '@tajriba/shared';

interface Subject {
  key: string;
  name: I18nText;
  color: string;
  icon: string;
  topicCount: number;
}

const SNAPSHOT_KEY = 'tj-map-states';

function MapInner() {
  const t = useTranslations('student');
  const tc = useTranslations('common');
  const l = useL();
  const params = useSearchParams();
  const subjects = useApi<Subject[]>('/subjects');
  const classes = useApi<ClassSummary[]>('/classes');
  const [picked, setPicked] = useState<string | null>(null);
  const visibleSubjects = useMemo(() => (subjects.data ?? []).filter((s) => s.topicCount > 0), [subjects.data]);
  // Default: the first subject (sorted by name on the server) that has skills — never a hardcoded one.
  const subject = picked && visibleSubjects.some((s) => s.key === picked) ? picked : (visibleSubjects[0]?.key ?? null);
  const graph = useApi<Graph>(subject ? `/subjects/${subject}/graph` : null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<string[]>([]);

  // Detect topics that became available/mastered since the last visit → play the unlock animation.
  useEffect(() => {
    if (!graph.data) return;
    const fromQuery = params.get('unlocked')?.split(',').filter(Boolean) ?? [];
    let prev: Record<string, string> = {};
    try {
      prev = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? '{}');
    } catch {
      prev = {};
    }
    const changed = graph.data.nodes.filter((n) => prev[n.id] === 'LOCKED' && n.state !== 'LOCKED').map((n) => n.id);
    setJustUnlocked([...new Set([...fromQuery, ...changed])]);
    try {
      const snap = { ...prev, ...Object.fromEntries(graph.data.nodes.map((n) => [n.id, n.state])) };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    } catch {
      /* ignore */
    }
  }, [graph.data, params]);

  const current = visibleSubjects.find((s) => s.key === subject);
  const st = subjectStyle(subject, current?.color, current?.icon);
  const unlockedNode = graph.data?.nodes.find((n) => justUnlocked.includes(n.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold">{t('mapTitle')}</h1>
        <p className="text-muted-foreground">{t('mapSub')}</p>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {visibleSubjects.map((s) => {
          const ss = subjectStyle(s.key, s.color, s.icon);
          const active = s.key === subject;
          return (
            <button
              key={s.key}
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(s.key)}
              className={cn('inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 font-bold transition-colors', active ? `${ss.bg} text-white shadow-md` : 'bg-card border-2 border-border')}
              data-testid={`subject-chip-${s.key}`}
            >
              <SubjectIcon icon={s.icon} className="size-5" /> {l(s.name)}
            </button>
          );
        })}
      </div>

      {unlockedNode && (
        <div className="rounded-[18px] border-2 border-sunny bg-sunny-soft p-3 text-center font-bold" data-testid="unlock-toast">
          {t('mapUnlockedToast', { name: l(unlockedNode.name) })}
        </div>
      )}

      {subjects.isLoading || (subject && graph.isLoading) ? (
        <PageSkeleton />
      ) : subjects.error ? (
        <ErrorState onRetry={() => subjects.refetch()} />
      ) : !subject ? (
        <EmptyState
          title={(classes.data?.length ?? 0) === 0 ? t('mapNoClasses') : t('mapNoSkills')}
          body={(classes.data?.length ?? 0) === 0 ? t('mapNoClassesBody') : t('mapNoSkillsBody')}
          className="rounded-[24px] border-2 border-dashed border-border bg-card"
        />
      ) : graph.error || !graph.data ? (
        <ErrorState onRetry={() => graph.refetch()} />
      ) : (
        <SkillMap nodes={graph.data.nodes} edges={graph.data.edges} color={st.hex} onSelect={setSelected} justUnlocked={justUnlocked} />
      )}

      <div className="flex flex-wrap justify-center gap-3 text-xs font-bold text-muted-foreground">
        {(['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'MASTERED'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn('size-3 rounded-full', s === 'LOCKED' ? 'bg-muted border border-border' : s === 'AVAILABLE' ? st.bg : s === 'IN_PROGRESS' ? 'bg-sunny' : 'bg-[#F5B700]')} />
            {tc(`mastery.${s}`)}
          </span>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <SheetContent data-testid="topic-sheet">
            <div className="flex items-center gap-3">
              <span className={cn('flex size-14 items-center justify-center rounded-full text-3xl', st.soft)} aria-hidden>
                <TopicGlyph topicKey={selected.key} icon={selected.icon} />
              </span>
              <div>
                <DialogTitle className="font-display text-2xl">{l(selected.name)}</DialogTitle>
                <Badge variant={selected.state === 'MASTERED' ? 'sunny' : selected.state === 'LOCKED' ? 'muted' : 'default'}>{tc(`mastery.${selected.state}`)}</Badge>
              </div>
            </div>
            <DialogDescription className="mt-3 text-base">{l(selected.description)}</DialogDescription>
            {selected.state === 'LOCKED' ? (
              <p className="mt-5 flex items-center gap-2 rounded-[16px] bg-muted p-4 font-semibold">
                <Lock className="size-5" /> {t('lockedTopic')}
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                <p className="font-bold">{t('missionsFor')}</p>
                {selected.missions.length === 0 && <BouslaSays mood="sleepy" size={56}>{t('noMissionsTopic')}</BouslaSays>}
                {selected.missions.map((m) => {
                  const href = m.submissionId && m.submissionStatus !== 'IN_PROGRESS' ? `/student/submissions/${m.submissionId}` : `/student/missions/${m.id}`;
                  return (
                    <Link key={m.id} href={href} className="flex items-center gap-3 rounded-[18px] border-2 border-border p-3 hover:border-primary" data-testid="sheet-mission">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-extrabold leading-tight">{l(m.title)}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="sunny">⚡ {t('xp', { xp: m.xpReward })}</Badge>
                          <Badge variant="muted">{tc('minutes', { n: m.estimatedMin })}</Badge>
                          {m.submissionStatus && <Badge variant={m.submissionStatus === 'VALIDATED' ? 'mint' : 'sky'}>{tc(`status.${m.submissionStatus}`)}</Badge>}
                        </div>
                      </div>
                      <ChevronRight className="rtl-flip size-6 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </SheetContent>
        )}
      </Dialog>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MapInner />
    </Suspense>
  );
}
