'use client';

import { ArrowRight, BookOpenCheck, CheckCircle2, GraduationCap, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { use, useState } from 'react';
import { PageSkeleton } from '@/components/app/states';
import { Arzino } from '@/components/arzino';
import { CoursePicker } from '@/components/teacher/course-picker';
import { ImportSuccess } from '@/components/teacher/import-success';
import { Stepper } from '@/components/teacher/stepper';
import type { ImportResult } from '@/components/teacher/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/hooks';

type Step = 'connect' | 'import' | 'done';

const PERK_TONES = ['bg-med-soft text-med-d dark:text-med', 'bg-cedar-soft text-cedar-d dark:text-success', 'bg-flame-soft text-flame-d dark:text-warning'];

export default function TeacherOnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const sp = use(searchParams);
  const t = useTranslations('teacher.onboarding');
  const { data: me, isLoading } = useMe();
  const [override, setOverride] = useState<Step | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);

  if (isLoading || !me) return <PageSkeleton />;
  const step: Step = override ?? (sp.step === 'import' || me.classroomConnected ? 'import' : 'connect');
  const index = { connect: 0, import: 1, done: 3 }[step];

  const panelMood = step === 'done' ? 'lebanese-pride' : step === 'import' ? 'teaching' : 'welcome';

  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[24px] border-2 border-border bg-card shadow-[0_4px_0_0_var(--border)] lg:grid-cols-[320px_1fr]">
      {/* Role-colored side panel (teacher = blue); phones drop it */}
      <aside className="relative hidden flex-col gap-6 bg-med p-8 text-white lg:flex">
        <div>
          <p className="eyebrow !text-white/80">{t('panelEyebrow')}</p>
          <h1 className="mt-1 font-display text-[32px] font-black leading-[1.1]">{t('title')}</h1>
          <p className="mt-2 font-semibold text-white/90">{t('subtitle')}</p>
        </div>
        <Arzino mood={panelMood} size={230} className="mx-auto my-auto" pop />
        <Stepper steps={[t('stepConnect'), t('stepImport'), t('stepDone')]} current={index} vertical onDark />
      </aside>
      <div className="min-w-0 p-6 md:p-9">
        <div className="mb-6 flex items-center gap-4 lg:hidden">
          <Arzino mood={panelMood} size={84} />
          <div>
            <h1 className="font-display text-[28px] font-black leading-tight">{t('title')}</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <div className="mb-7 lg:hidden">
          <Stepper steps={[t('stepConnect'), t('stepImport'), t('stepDone')]} current={index} />
        </div>
        {step === 'connect' && <ConnectStep connected={me.classroomConnected} onNext={() => setOverride('import')} />}
        {step === 'import' && (
          <>
            <h2 className="font-display text-[24px] font-black leading-tight">{t('importTitle')}</h2>
            <p className="mb-6 mt-1 text-sm font-semibold text-muted-foreground">{t('importBody')}</p>
            <CoursePicker
              onImported={(r) => {
                setResults(r);
                setOverride('done');
              }}
            />
          </>
        )}
        {step === 'done' && <ImportSuccess results={results} />}
      </div>
    </div>
  );
}

function ConnectStep({ connected, onNext }: { connected: boolean; onNext: () => void }) {
  const t = useTranslations('teacher.onboarding');
  const perks = [
    { icon: GraduationCap, text: t('perkRoster') },
    { icon: Send, text: t('perkPost') },
    { icon: BookOpenCheck, text: t('perkGrades') },
  ];
  return (
    <div>
      <div>
        <h2 className="font-display text-[24px] font-black leading-tight">{t('connectTitle')}</h2>
        <p className="mt-1 font-semibold text-muted-foreground">{t('connectBody')}</p>
        <ul className="mt-6 space-y-3">
          {perks.map((p, i) => (
            <li key={p.text} className="flex items-center gap-3 rounded-[16px] border-2 border-border p-3 text-[15px] font-bold">
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-[14px]', PERK_TONES[i])}>
                <p.icon className="size-5" strokeWidth={2.4} />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
        <div className="mt-7">
          {connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 font-extrabold text-cedar-d dark:text-success">
                <CheckCircle2 className="size-5" /> {t('connected')}
              </span>
              <Button variant="kidMint" onClick={onNext} data-testid="onboarding-next">
                {t('next')} <ArrowRight className="rtl-flip" />
              </Button>
            </div>
          ) : (
            <Button asChild size="pill" variant="kidMint">
              <a href="/api/classroom/connect" data-testid="connect-classroom">
                <GoogleMark /> {t('connectCta')}
              </a>
            </Button>
          )}
          <p className="mt-4 text-xs font-semibold text-muted-foreground">{t('privacy')}</p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-white" aria-hidden>
      <svg viewBox="0 0 24 24" className="size-4">
        <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
      </svg>
    </span>
  );
}
