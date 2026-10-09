'use client';

import { ChevronRight, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Arzino, ArzinoSays } from '@/components/arzino';
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

  const nodes = graph.data?.nodes ?? [];
  const mastered = nodes.filter((n) => n.state === 'MASTERED').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Arzino mood="starry-eyed" size={96} />
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-black leading-tight">{t('mapTitle')}</h1>
          <p className="font-bold text-muted-foreground">{t('mapSub')}</p>
        </div>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist">
        {visibleSubjects.map((s) => {
          const ss = subjectStyle(s.key, s.color, s.icon);
          const active = s.key === subject;
          return (
            <button
              key={s.key}
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(s.key)}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-2 rounded-[14px] border-2 px-4 text-sm font-black uppercase tracking-[0.06em] transition-colors',
                active ? 'border-transparent text-white' : 'border-border bg-card text-muted-foreground shadow-[0_3px_0_var(--border)] hover:bg-muted',
              )}
              style={active ? { background: ss.hex, boxShadow: `0 4px 0 ${ss.hexD}` } : undefined}
              data-testid={`subject-chip-${s.key}`}
            >
              <SubjectIcon icon={s.icon} className="size-5" /> {l(s.name)}
            </button>
          );
        })}
      </div>

      {unlockedNode && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="flex items-center gap-3 rounded-[20px] border-2 border-[#FFC21A] bg-[#FFF5D6] p-3 font-black text-ink shadow-[0_4px_0_#E0A800] dark:bg-[#3b3212] dark:text-white"
          data-testid="unlock-toast"
        >
          <Arzino mood="shocked" size={64} />
          <span className="text-lg leading-tight">{t('mapUnlockedToast', { name: l(unlockedNode.name) })}</span>
        </motion.div>
      )}

      {subjects.isLoading || (subject && graph.isLoading) ? (
        <PageSkeleton />
      ) : subjects.error ? (
        <ErrorState onRetry={() => subjects.refetch()} />
      ) : !subject ? (
        <EmptyState
          title={(classes.data?.length ?? 0) === 0 ? t('mapNoClasses') : t('mapNoSkills')}
          body={(classes.data?.length ?? 0) === 0 ? t('mapNoClassesBody') : t('mapNoSkillsBody')}
          className="chunky rounded-[20px]"
        />
      ) : graph.error || !graph.data ? (
        <ErrorState onRetry={() => graph.refetch()} />
      ) : (
        <SkillMap
          nodes={graph.data.nodes}
          edges={graph.data.edges}
          color={st.hex}
          colorD={st.hexD}
          onSelect={setSelected}
          justUnlocked={justUnlocked}
          banner={(g, gi) => (
            <div className="flex items-center gap-3 rounded-[20px] px-5 py-4 text-white" style={{ background: st.hex, boxShadow: `0 5px 0 ${st.hexD}` }}>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black uppercase tracking-[0.09em] text-white/85">{t('unitLabel', { n: gi + 1, grade: g.grade })}</p>
                <p className="font-display text-[22px] font-black leading-tight">{l(current?.name ?? graph.data!.subject.name)}</p>
              </div>
              <span className="shrink-0 rounded-[12px] border-2 border-white/40 px-3 py-1.5 text-xs font-black uppercase tracking-[0.06em]">
                {t('masteredCount', { done: g.nodes.filter((n) => n.state === 'MASTERED').length, total: g.nodes.length })}
              </span>
            </div>
          )}
        />
      )}

      {nodes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pb-2 text-xs font-extrabold text-muted-foreground">
          {(['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'MASTERED'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="size-3.5 rounded-full"
                style={{ background: s === 'LOCKED' ? 'var(--lock-d)' : s === 'MASTERED' ? '#FFC21A' : st.hex, opacity: s === 'IN_PROGRESS' ? 0.6 : 1 }}
              />
              {tc(`mastery.${s}`)}
            </span>
          ))}
          <span className="sr-only">{t('masteredCount', { done: mastered, total: nodes.length })}</span>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <SheetContent data-testid="topic-sheet">
            <div className="flex items-center gap-3">
              <Arzino mood={selected.state === 'LOCKED' ? 'sleepy' : selected.state === 'MASTERED' ? 'proud' : 'reading'} size={92} />
              <div className="min-w-0">
                <p className="eyebrow">{tc(`mastery.${selected.state}`)}</p>
                <DialogTitle className="font-display text-2xl font-black leading-tight">
                  <span className="me-1.5" aria-hidden>
                    <TopicGlyph topicKey={selected.key} icon={selected.icon} />
                  </span>
                  {l(selected.name)}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="mt-3 text-base font-semibold">{l(selected.description)}</DialogDescription>
            {selected.state === 'LOCKED' ? (
              <p className="mt-5 flex items-center gap-2 rounded-[16px] border-2 border-border bg-muted p-4 font-bold">
                <Lock className="size-5 shrink-0 text-muted-foreground" /> {t('lockedTopic')}
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                <p className="eyebrow">{t('missionsFor')}</p>
                {selected.missions.length === 0 && (
                  <ArzinoSays mood="bored-waiting" size={64}>
                    {t('noMissionsTopic')}
                  </ArzinoSays>
                )}
                {selected.missions.map((m) => {
                  const href = m.submissionId && m.submissionStatus !== 'IN_PROGRESS' ? `/student/submissions/${m.submissionId}` : `/student/missions/${m.id}`;
                  return (
                    <Link key={m.id} href={href} className="chunky chunky-hover flex items-center gap-3 rounded-[20px] p-3.5" data-testid="sheet-mission">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] text-2xl" style={{ background: st.hex, boxShadow: `0 4px 0 ${st.hexD}` }} aria-hidden>
                        <TopicGlyph topicKey={selected.key} icon={selected.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-black leading-tight">{l(m.title)}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="sky">⚡ {t('xp', { xp: m.xpReward })}</Badge>
                          <Badge variant="muted">{tc('minutes', { n: m.estimatedMin })}</Badge>
                          {m.submissionStatus && <Badge variant={m.submissionStatus === 'VALIDATED' ? 'mint' : m.submissionStatus === 'RETRY' ? 'sunny' : 'sky'}>{tc(`status.${m.submissionStatus}`)}</Badge>}
                        </div>
                      </div>
                      <ChevronRight className="rtl-flip size-6 shrink-0 text-muted-foreground" />
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
