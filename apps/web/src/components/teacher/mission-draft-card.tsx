'use client';

import type { Difficulty } from '@tajriba/shared';
import { Camera, CheckCircle2, Clock, ExternalLink, FileText, HardHat, Rocket, Sparkles, Trash2, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VisualSpecView } from '@/components/kid/visual-spec';
import { Arzino } from '@/components/arzino';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { Mission } from '@/lib/types';
import { EditableSteps } from './editable-steps';
import { EditableText } from './editable-text';
import { errMessage } from './helpers';
import { PublishDialog } from './publish-dialog';
import { SafetyBadge } from './safety-badge';
import { toast } from './toast';
import type { ApproveResult, SafetyResult } from './types';

interface Props {
  mission: Mission;
  index: number;
  className: string;
  classroomLinked: boolean;
  onChange: (m: Mission) => void;
  onRemove: (id: string) => void;
  /** course template: approval publishes to every section */
  courseMode?: boolean;
}

type I18n = { en: string; ar?: string; fr?: string };

/** One AI draft in the mission studio: inline editing, safety badge, approve & publish. */
export function MissionDraftCard({ mission: m, index, className, classroomLinked, onChange, onRemove, courseMode = false }: Props) {
  const t = useTranslations('teacher.studio');
  const td = useTranslations('common.difficulty');
  const l = useL();
  const locale = useLocale();
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [classroom, setClassroom] = useState<ApproveResult['classroom']>(null);
  const latest = useRef(m);
  latest.current = m;

  const isDraft = m.status === 'DRAFT';
  const published = m.status === 'APPROVED';
  const editKey = (txt: I18n): 'en' | 'ar' => (locale === 'ar' && txt.ar ? 'ar' : 'en');

  const runSafety = useCallback(async () => {
    setChecking(true);
    try {
      const s = await api<SafetyResult>(`/missions/${m.id}/safety-check`, { method: 'POST' });
      onChange({ ...latest.current, safetyCheck: s });
    } catch (e) {
      toast(errMessage(e, t('safetyError')), 'error');
    } finally {
      setChecking(false);
    }
  }, [m.id, onChange, t]);

  // Drafts saved without a check (e.g. after an edit) get one automatically.
  useEffect(() => {
    if (isDraft && !m.safetyCheck && !checking) void runSafety();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the check is cleared
  }, [m.safetyCheck]);

  const patch = async (body: Record<string, unknown>) => {
    try {
      const updated = await api<Mission>(`/missions/${m.id}`, { method: 'PATCH', body });
      onChange({ ...latest.current, ...updated, topic: updated.topic ?? latest.current.topic });
      toast(t('saved'));
    } catch (e) {
      toast(errMessage(e, t('saveError')), 'error');
      throw e;
    }
  };

  const useSafer = async () => {
    const safer = m.safetyCheck?.saferVersion;
    if (!safer) return;
    setBusy(true);
    try {
      const steps = safer.split(/(?<=\.)\s+/).filter(Boolean);
      await patch({ steps, safetyNotes: { en: safer } });
    } catch {
      // toast already shown
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await api(`/missions/${m.id}/archive`, { method: 'POST' });
      onRemove(m.id);
      toast(t('discarded'), 'info');
    } catch (e) {
      toast(errMessage(e, t('saveError')), 'error');
    } finally {
      setBusy(false);
    }
  };

  const title = l(m.title);
  const steps = l(m.steps) ?? [];
  const safe = m.safetyCheck?.safe === true;

  return (
    <Card className={cn('overflow-hidden transition-colors', published && 'border-cedar shadow-[0_4px_0_0_var(--cedar)]')} data-testid="mission-draft-card" data-status={m.status}>
      {published && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-cedar px-5 py-2 text-sm font-extrabold text-white" data-testid="published-badge">
          <span className="flex items-center gap-2">
            <Arzino mood="celebrate" size={48} animate={false} className="-my-1" />
            <CheckCircle2 className="size-5" /> {t('publishedTo', { className })}
          </span>
          {classroom?.posted && (
            <span className="flex items-center gap-1.5" data-testid="posted-to-classroom">
              <ExternalLink className="size-4" /> {t('postedToClassroom')}
            </span>
          )}
          {classroom && !classroom.posted && classroom.error && <span className="rounded-full bg-white/90 px-2 py-0.5 font-bold text-flame-d">{classroom.error}</span>}
        </div>
      )}
      <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-[1fr_300px]">
        {/* Left: the mission itself */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="sky">{t('missionN', { n: index + 1 })}</Badge>
            {m.topic && <Badge variant="default">{l(m.topic.name)}</Badge>}
            {m.audience === 'FAMILY' && (
              <Badge variant="sunny">
                <Users /> {t('familyMission')}
              </Badge>
            )}
            {m.aiGenerated && (
              <Badge variant="muted">
                <Sparkles /> {t('aiDraft')}
              </Badge>
            )}
          </div>
          <EditableText
            value={title}
            label={t('fieldTitle')}
            disabled={!isDraft}
            className="font-display text-[24px] font-black leading-snug"
            onSave={(v) => patch({ title: { ...m.title, [editKey(m.title)]: v } })}
            testId="draft-title"
          />
          <EditableText
            value={l(m.story)}
            multiline
            label={t('fieldStory')}
            disabled={!isDraft}
            className="text-[15px] font-semibold leading-relaxed text-muted-foreground"
            onSave={(v) => patch({ story: { ...m.story, [editKey(m.story)]: v } })}
            testId="draft-story"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Select
              value={m.difficulty}
              disabled={!isDraft}
              onChange={(e) => patch({ difficulty: e.target.value as Difficulty }).catch(() => undefined)}
              className="h-9 w-auto rounded-full px-3 text-sm font-bold"
              aria-label={t('fieldDifficulty')}
              data-testid="draft-difficulty"
            >
              {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => (
                <option key={d} value={d}>
                  {td(d)}
                </option>
              ))}
            </Select>
            <MinutesField value={m.estimatedMin} disabled={!isDraft} onSave={(n) => patch({ estimatedMin: n })} label={t('fieldMinutes')} />
            <Badge variant="sky" className="h-9 px-3 text-sm">
              +{m.xpReward} XP
            </Badge>
          </div>
          <section>
            <h4 className="eyebrow mb-2">{t('steps')}</h4>
            <EditableSteps steps={steps} disabled={!isDraft} onSave={(s) => patch({ steps: s })} />
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="eyebrow mb-2">{t('proof')}</h4>
              <div className="flex flex-wrap gap-1.5">
                {m.proofSpec.photos > 0 && (
                  <Badge variant="outline">
                    <Camera /> {t('photos', { n: m.proofSpec.photos })}
                  </Badge>
                )}
                {m.proofSpec.explanation && (
                  <Badge variant="outline">
                    <FileText /> {t('explanation')}
                  </Badge>
                )}
                {m.proofSpec.fields.map((f) => (
                  <Badge key={f.key} variant="outline">
                    {l(f.label)}
                    {f.unit ? ` (${f.unit})` : ''}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="eyebrow mb-2">{t('rubric')}</h4>
              <ul className="space-y-1.5">
                {m.rubric.map((r) => (
                  <li key={r.criterion} className="text-sm" title={r.description}>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold">{r.criterion}</span>
                      <span className="font-black tabular-nums text-med-d dark:text-med">{r.weight}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-lock">
                      <div className="h-full rounded-full bg-med" style={{ width: `${r.weight}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* Right: lesson preview, safety, actions */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-[18px] border-2 border-med/25 bg-med-soft/60 p-4">
            <h4 className="eyebrow mb-2">{t('miniLesson')}</h4>
            <VisualSpecView spec={m.miniLesson.visualSpec} className="mx-auto max-w-[200px]" />
            <p className="mt-2 text-sm font-semibold leading-relaxed">{l(m.miniLesson.text)}</p>
          </div>
          {l(m.safetyNotes) && (
            <p className="flex gap-2 rounded-[14px] border-2 border-flame/30 bg-flame-soft/60 p-3 text-sm">
              <HardHat className="mt-0.5 size-4 shrink-0 text-flame-d" />
              <span>
                <span className="font-bold">{t('safetyNotes')}: </span>
                {l(m.safetyNotes)}
              </span>
            </p>
          )}
          {isDraft && <SafetyBadge check={m.safetyCheck} checking={checking} busy={busy} onUseSafer={useSafer} onRecheck={runSafety} />}
          {isDraft && (
            <div className="mt-auto flex flex-col gap-2">
              <Button size="lg" variant="kid" onClick={() => setPublishOpen(true)} disabled={!safe || checking || busy} data-testid="approve-publish">
                <Rocket /> {t('approve')}
              </Button>
              {!safe && !checking && m.safetyCheck && <p className="text-center text-xs font-semibold text-muted-foreground">{t('fixFirst')}</p>}
              <Button variant="ghost" size="sm" onClick={discard} disabled={busy} className="text-muted-foreground" data-testid="discard-draft">
                <Trash2 /> {t('discard')}
              </Button>
            </div>
          )}
        </aside>
      </div>
      {isDraft && (
        <PublishDialog
          mission={m}
          title={title}
          className={className}
          classroomLinked={classroomLinked}
          courseMode={courseMode}
          open={publishOpen}
          onOpenChange={setPublishOpen}
          onSafety={(s) => onChange({ ...latest.current, safetyCheck: s })}
          onPublished={(r) => {
            setClassroom(r.classroom);
            onChange({ ...latest.current, ...r.mission, topic: r.mission.topic ?? latest.current.topic });
            toast(t('publishedToast'));
          }}
        />
      )}
    </Card>
  );
}

function MinutesField({ value, disabled, onSave, label }: { value: number; disabled: boolean; onSave: (n: number) => Promise<void>; label: string }) {
  const t = useTranslations('teacher.studio');
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 5 || n > 240) return setV(String(value));
    if (n !== value) onSave(n).catch(() => setV(String(value)));
  };
  return (
    <label className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 font-bold">
      <Clock className="size-4 text-muted-foreground" />
      <input
        type="number"
        min={5}
        max={240}
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-10 bg-transparent text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={label}
        data-testid="draft-minutes"
      />
      <span className="text-muted-foreground">{t('min')}</span>
    </label>
  );
}
