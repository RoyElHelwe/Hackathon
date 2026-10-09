'use client';

import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Arzino, ArzinoSays, type ArzinoMood } from '@/components/arzino';
import { FamilyKeypad } from '@/components/app/family-keypad';
import { LanguageSwitch } from '@/components/app/locale';
import { Logo } from '@/components/app/logo';
import { PageSkeleton } from '@/components/app/states';
import { SubjectPicker } from '@/components/director/subject-picker';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { cn } from '@/lib/cn';

type Mode = null | 'create' | 'join' | 'child' | 'student';
type SchoolPreview = { school: { name: string }; subjects: { id: string; name: { en: string; ar?: string } }[] };

/** Panel color + pose per path (DESIGN.md: School red · Teacher blue · Student cedar · Parent flame). */
const LOOK: Record<'default' | Exclude<Mode, null>, { panel: string; bar: string; tag: string; mood: ArzinoMood; role: string }> = {
  default: { panel: 'bg-cedar', bar: 'bg-cedar', tag: 'bg-cedar-soft text-cedar-ink dark:text-success', mood: 'welcome', role: '' },
  create: { panel: 'bg-flag', bar: 'bg-flag', tag: 'bg-flag-soft text-flag-d dark:text-danger', mood: 'lebanese-pride', role: 'DIRECTOR' },
  join: { panel: 'bg-med', bar: 'bg-med', tag: 'bg-med-soft text-med-ink dark:text-white', mood: 'teaching', role: 'TEACHER' },
  child: { panel: 'bg-flame', bar: 'bg-flame', tag: 'bg-flame-soft text-flame-d dark:text-warning', mood: 'warm', role: 'PARENT' },
  student: { panel: 'bg-cedar', bar: 'bg-cedar', tag: 'bg-cedar-soft text-cedar-ink dark:text-success', mood: 'celebrate', role: 'STUDENT' },
};

export default function Onboarding() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { data: me, isLoading, error, refetch } = useMe();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: '', code: '' });
  const [pending, setPending] = useState<string | null>(null);
  const [schoolPreview, setSchoolPreview] = useState<SchoolPreview | null>(null);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace('/login?next=/onboarding');
    else if (me?.active) router.replace(me.home);
  }, [me, error, router]);

  if (isLoading || !me || me.active) return <PageSkeleton />;
  const pendingMembership = me.memberships.find((m) => m.status === 'PENDING');
  const waiting = pending || pendingMembership;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const findSchool = () =>
    run(async () => {
      const r = await api<SchoolPreview>(`/schools/by-code/${encodeURIComponent(form.code.trim())}/subjects`);
      setSchoolPreview(r);
      setSubjectIds([]);
    });

  const choose = (m: Mode) => {
    setMode(m);
    setErr(null);
    setSchoolPreview(null);
    setSubjectIds([]);
  };

  const options = [
    { id: 'student' as const, mood: 'cheer' as ArzinoMood, title: t('imStudent'), body: t('studentCode') },
    { id: 'join' as const, mood: 'teaching' as ArzinoMood, title: t('joinSchool'), body: t('joinSchoolBody') },
    { id: 'create' as const, mood: 'clipboard' as ArzinoMood, title: t('createSchool'), body: t('createSchoolBody') },
    { id: 'child' as const, mood: 'warm' as ArzinoMood, title: t('linkChild'), body: t('linkChildBody') },
  ];

  const panelKey = waiting ? (pendingMembership?.role === 'STUDENT' ? 'student' : 'join') : (mode ?? 'default');
  const look = LOOK[panelKey];

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,46%)_1fr]">
      {/* Role-colored side panel with a big Arzino (desktop only) */}
      <aside className={cn('relative hidden flex-col items-center justify-center overflow-hidden p-10 text-center text-white transition-colors duration-500 lg:flex', look.panel)}>
        <div className="absolute inset-x-0 top-0 h-5 bg-white/15" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-5 bg-white/15" aria-hidden />
        <div className="absolute size-[460px] rounded-full bg-white/10" aria-hidden />
        <AnimatePresence mode="wait">
          <motion.div
            key={waiting ? `waiting-${panelKey}` : panelKey}
            className="relative flex flex-col items-center"
            initial={reduce ? false : { opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            <Arzino mood={waiting ? 'bored-waiting' : look.mood} size={340} priority />
            <h2 className="mt-6 max-w-md font-display text-[32px] leading-tight">{t(`panel.${panelKey}Title`)}</h2>
            <p className="mt-3 max-w-sm text-lg font-bold text-white/90">{t(`panel.${panelKey}Body`)}</p>
          </motion.div>
        </AnimatePresence>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Logo small />
          <LanguageSwitch compact />
        </header>

        <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-2 sm:px-8 lg:pt-8">
          {waiting ? (
            <motion.div className="flex flex-col items-center gap-3 pt-6 text-center" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Arzino mood="bored-waiting" size={180} className="lg:hidden" />
              <h1 className="font-display text-[30px] leading-tight sm:text-[34px]">{t('pendingTitle')}</h1>
              <p className="text-lg text-muted-foreground">{t('pendingBody', { school: pending ?? pendingMembership?.school.name ?? '' })}</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-3">
                <RefreshCw /> {t('pendingRefresh')}
              </Button>
            </motion.div>
          ) : (
            <>
              {/* progress row: back · bar · role tag */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => choose(null)}
                  disabled={!mode}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:invisible"
                  aria-label={tc('back')}
                >
                  <ChevronLeft className="rtl-flip size-6" />
                </button>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-lock" role="progressbar" aria-valuenow={mode ? 2 : 1} aria-valuemin={1} aria-valuemax={2} aria-label={t('stepLabel', { n: mode ? 2 : 1 })}>
                  <motion.div className={cn('bar-gloss h-full rounded-full', look.bar)} initial={false} animate={{ width: mode ? '100%' : '50%' }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                </div>
                {mode && <span className={cn('eyebrow shrink-0 rounded-full px-3 py-1', look.tag)}>{tc(`roles.${look.role}`)}</span>}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {!mode ? (
                  <motion.section key="choose" initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -24 }}>
                    <ArzinoSays mood="starry-eyed" size={84} className="mt-6 lg:hidden">
                      {t('onboardingSubtitle', { name: me.user.name.split(' ')[0] })}
                    </ArzinoSays>
                    <h1 className="mt-6 font-display text-[30px] leading-tight sm:text-[34px]">{t('onboardingTitle')}</h1>
                    <p className="mt-2 hidden text-lg text-muted-foreground lg:block">{t('onboardingSubtitle', { name: me.user.name.split(' ')[0] })}</p>
                    <div className="mt-6 space-y-3">
                      {options.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => choose(o.id)}
                          className="chunky chunky-hover flex w-full items-center gap-4 rounded-[20px] p-3 text-start"
                          data-testid={`onboard-${o.id}`}
                        >
                          <span className={cn('flex size-[76px] shrink-0 items-end justify-center rounded-[16px]', LOOK[o.id].tag)}>
                            <Arzino mood={o.mood} size={72} animate={false} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-display text-lg leading-tight">{o.title}</span>
                            <span className="mt-0.5 block text-sm text-muted-foreground">{o.body}</span>
                          </span>
                          <ChevronRight className="rtl-flip size-5 shrink-0 text-lock-d" />
                        </button>
                      ))}
                    </div>
                  </motion.section>
                ) : (
                  <motion.section key={mode} initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -24 }} className="mt-6">
                    <div className="mb-5 flex items-center gap-3 lg:hidden">
                      <Arzino mood={look.mood} size={84} />
                      <p className="font-display text-lg leading-tight">{t(`panel.${mode}Title`)}</p>
                    </div>
                    <h1 className="font-display text-[28px] leading-tight sm:text-[32px]">{options.find((o) => o.id === mode)?.title}</h1>

                    <div className="mt-5">
                      {mode === 'create' && (
                        <form
                          className="space-y-4"
                          onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                              await api('/schools', { body: { name: form.name, city: form.city, gradeLevels: [7, 8, 9] } });
                              window.location.href = '/director';
                            });
                          }}
                        >
                          <p className="text-muted-foreground">{t('createSchoolBody')}</p>
                          <div>
                            <Label htmlFor="sname">{t('schoolName')}</Label>
                            <Input id="sname" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                          </div>
                          <div>
                            <Label htmlFor="city">{t('city')}</Label>
                            <Input id="city" required minLength={2} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                          </div>
                          <Button type="submit" variant="kidCoral" size="lg" loading={busy} className="w-full">
                            {t('create')}
                          </Button>
                        </form>
                      )}
                      {mode === 'student' && (
                        <form
                          className="space-y-4"
                          onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                              const r = await api<{ school: { name: string }; membership: { status: string } }>('/schools/join', {
                                body: { code: form.code, role: 'STUDENT' },
                              });
                              setPending(r.school.name);
                              refetch();
                            });
                          }}
                        >
                          <p className="text-muted-foreground">{t('imStudentBody')}</p>
                          <div>
                            <Label htmlFor="code">{t('schoolCode')}</Label>
                            <CodeInput value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
                          </div>
                          <Button type="submit" variant="kid" size="lg" loading={busy} className="w-full">
                            {t('join')}
                          </Button>
                        </form>
                      )}
                      {mode === 'join' && (
                        <div className="space-y-4">
                          <p className="text-muted-foreground">{t('joinSchoolBody')}</p>
                          <div>
                            <Label htmlFor="code">{t('schoolCode')}</Label>
                            <CodeInput
                              value={form.code}
                              onChange={(v) => {
                                setForm({ ...form, code: v });
                                setSchoolPreview(null);
                                setSubjectIds([]);
                              }}
                              onEnter={() => {
                                if (!schoolPreview && form.code.trim() && !busy) findSchool();
                              }}
                            />
                          </div>
                          {!schoolPreview ? (
                            <Button type="button" variant="kidMint" size="lg" loading={busy} disabled={!form.code.trim()} className="w-full" data-testid="find-school" onClick={findSchool}>
                              {t('findSchool')}
                            </Button>
                          ) : (
                            <>
                              <div className="flex items-center gap-3 rounded-[18px] bg-med-soft p-3">
                                <Arzino mood="lebanese-pride" size={56} animate={false} />
                                <p className="font-display text-lg text-med-ink dark:text-white" data-testid="join-school-name">
                                  {schoolPreview.school.name}
                                </p>
                              </div>
                              {schoolPreview.subjects.length > 0 && (
                                <div>
                                  <Label>{t('teacherSubjects')}</Label>
                                  <SubjectPicker options={schoolPreview.subjects} value={subjectIds} onChange={setSubjectIds} locale={locale} className="mt-1" />
                                </div>
                              )}
                              <Button
                                type="button"
                                variant="kidMint"
                                size="lg"
                                loading={busy}
                                className="w-full"
                                data-testid="join-school"
                                onClick={() =>
                                  run(async () => {
                                    const r = await api<{ school: { name: string }; membership: { status: string } }>('/schools/join', {
                                      body: { code: form.code, role: 'TEACHER', subjectIds },
                                    });
                                    setPending(r.school.name);
                                    refetch();
                                  })
                                }
                              >
                                {t('join')}
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                      {mode === 'child' && (
                        <div className="space-y-5">
                          <p className="text-muted-foreground">{t('linkChildBody')}</p>
                          <FamilyKeypad
                            disabled={busy}
                            error={err}
                            onComplete={(code) =>
                              run(async () => {
                                await api('/families/link', { body: { code } });
                                window.location.href = '/parent';
                              })
                            }
                          />
                        </div>
                      )}
                      {err && (
                        <p className="mt-4 rounded-[16px] border-2 border-flag/30 bg-flag-soft p-3 text-center font-bold text-flag-d dark:text-danger" role="alert">
                          {err}
                        </p>
                      )}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function CodeInput({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  return (
    <Input
      id="code"
      required
      placeholder="TRP-2036"
      dir="ltr"
      autoComplete="off"
      className="h-14 text-center font-mono text-xl font-extrabold uppercase tracking-[0.2em]"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !onEnter) return;
        e.preventDefault();
        onEnter();
      }}
    />
  );
}
