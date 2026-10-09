import { ArrowRight, Check, Clock, Flame, Lock, Star, TreePine, Zap } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Arzino, type ArzinoMood } from '@/components/arzino';
import { GoogleG } from '@/components/app/google-g';
import { LanguageSwitch } from '@/components/app/locale';
import { Logo } from '@/components/app/logo';
import { FloatChip, Marquee, Reveal, Wiggle } from '@/components/app/motion-bits';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type T = Awaited<ReturnType<typeof getTranslations>>;

export default async function Landing() {
  const t = await getTranslations('landing');
  const rtl = (await getLocale()) === 'ar';

  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      <Header t={t} />
      <main>
        <Hero t={t} />
        <MissionStrip t={t} rtl={rtl} />
        <HowItWorks t={t} />
        <GameBento t={t} />
        <MeetArzino t={t} />
        <Campus t={t} />
        <Roles t={t} />
        <Vision t={t} />
        <Roadmap t={t} />
        <FinalCta t={t} />
      </main>
      <Footer t={t} />
    </div>
  );
}

/* ---------------------------------------------------------------- header */

function Header({ t }: { t: T }) {
  const nav = [
    ['#how', t('nav.how')],
    ['#arzino', t('nav.arzino')],
    ['#campus', t('nav.campus')],
    ['#roles', t('nav.roles')],
    ['#vision', t('nav.vision')],
  ] as const;
  return (
    <header className="sticky top-0 z-40 border-b-2 border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:h-[72px]">
        <Logo small />
        <nav className="hidden items-center gap-6 xl:flex" aria-label="Main">
          {nav.map(([href, label]) => (
            <a key={href} href={href} className="whitespace-nowrap text-[15px] font-extrabold text-muted-foreground transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitch compact />
          <Link href="/login" className="hidden whitespace-nowrap px-2 text-[15px] font-black uppercase tracking-[0.08em] text-med-ink hover:text-med dark:text-med sm:inline">
            {t('logIn')}
          </Link>
          <Button asChild variant="kid" size="sm" className="px-4">
            <Link href="/login">{t('getStarted')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero({ t }: { t: T }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-6 md:pb-20 md:pt-16">
      <Reveal>
        <span className="eyebrow inline-flex items-center gap-1.5 rounded-full bg-cedar-soft px-3 py-1.5 text-cedar-ink! dark:text-white!">
          <TreePine className="size-4" aria-hidden /> {t('eyebrow')}
        </span>
        <h1 className="mt-5 font-display text-[40px] leading-[1.04] tracking-tight sm:text-[54px] lg:text-[62px]">
          {t('heroTitleA')}{' '}
          <span className="text-cedar underline decoration-flame decoration-wavy decoration-[3px] underline-offset-[10px] [text-decoration-skip-ink:none]">{t('heroTitleB')}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">{t('heroBody')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild variant="kid" size="lg" data-testid="cta-signin">
            <Link href="/login">{t('ctaStart')}</Link>
          </Button>
          <Button asChild variant="kidGhost" size="lg">
            <Link href="/login#demo">
              {t('ctaDemo')} <ArrowRight className="rtl-flip" />
            </Link>
          </Button>
        </div>
        <div className="mt-7 flex items-center gap-2">
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {(['streak-hug', 'starry-eyed', 'trophy'] as const).map((m) => (
              <Arzino key={m} mood={m} size={46} animate={false} />
            ))}
          </div>
          <p className="text-sm font-bold text-muted-foreground">{t('heroFoot')}</p>
        </div>
      </Reveal>

      <div className="relative mx-auto h-[330px] w-full max-w-[340px] sm:h-[460px] sm:max-w-[480px]">
        <div className="absolute inset-x-4 inset-y-6 rounded-full bg-cedar-soft sm:inset-x-6" aria-hidden />
        <div className="absolute inset-x-12 inset-y-16 rounded-full border-2 border-dashed border-cedar/25" aria-hidden />
        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <Arzino mood="celebrate" size={360} pop priority className="size-[270px]! sm:size-[380px]!" />
        </div>
        <FloatChip className="start-0 top-4 sm:top-10" delay={0}>
          <div className="chunky rounded-[18px] px-3.5 py-2.5 sm:px-4 sm:py-3">
            <p className="font-display text-[15px] text-cedar-ink dark:text-success sm:text-lg">{t('chipNailed')}</p>
            <p className="text-xs font-extrabold text-muted-foreground">{t('chipNailedSub')}</p>
          </div>
        </FloatChip>
        <FloatChip className="end-0 top-0 sm:end-2" delay={0.3}>
          <div className="chunky flex items-center gap-1.5 rounded-[18px] px-3.5 py-2.5">
            <Flame className="flame size-5 fill-flame text-flame" aria-hidden />
            <span className="font-display text-lg text-flame-d dark:text-warning">7</span>
            <span className="text-xs font-extrabold text-muted-foreground">{t('chipStreak')}</span>
          </div>
        </FloatChip>
        <FloatChip className="bottom-20 end-0 sm:bottom-28" delay={0.6} amplitude={5}>
          <div className="-rotate-6 rounded-[14px] border-[3px] border-cedar bg-card px-3 py-1.5 text-base font-black uppercase tracking-[0.08em] text-cedar shadow-[0_4px_0_var(--cedar-d)] sm:text-lg">
            {t('chipValidated')}
          </div>
        </FloatChip>
        <FloatChip className="bottom-3 start-2 sm:bottom-8" delay={0.9} amplitude={6}>
          <div className="chunky w-40 rounded-[18px] px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm text-med-ink dark:text-white">{t('chipLevel')}</span>
              <Zap className="size-4 fill-med text-med" aria-hidden />
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-lock">
              <div className="bar-gloss h-full w-[72%] rounded-full bg-med" />
            </div>
          </div>
        </FloatChip>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- mission strip */

function MissionStrip({ t, rtl }: { t: T; rtl: boolean }) {
  const items = [
    ['🌓', 'shadows'],
    ['🍕', 'pizza'],
    ['🛢️', 'tank'],
    ['🟩', 'tiles'],
    ['🏃', 'speed'],
    ['🎙️', 'grandparent'],
    ['🧪', 'kitchen'],
    ['📐', 'ramp'],
  ] as const;
  return (
    <section className="border-y-2 border-border bg-muted py-4" aria-label={t('howEyebrow')}>
      <Marquee rtl={rtl} seconds={45}>
        {items.map(([emoji, key]) => (
          <span key={key} className="chunky inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[15px] font-extrabold">
            <span aria-hidden>{emoji}</span>
            {t(`missions.${key}`)}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ---------------------------------------------------------------- shared bits */

function SectionHead({ eyebrow, title, body, center }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <Reveal className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <p className="eyebrow text-cedar-ink! dark:text-success!">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl leading-tight md:text-[40px]">{title}</h2>
      {body && <p className="mt-3 text-lg text-muted-foreground">{body}</p>}
    </Reveal>
  );
}

const TONE = {
  cedar: { bg: 'bg-cedar', soft: 'bg-cedar-soft', text: 'text-cedar-ink dark:text-success', edge: 'shadow-[0_5px_0_var(--cedar-d)]' },
  med: { bg: 'bg-med', soft: 'bg-med-soft', text: 'text-med-ink dark:text-white', edge: 'shadow-[0_5px_0_var(--med-d)]' },
  flame: { bg: 'bg-flame', soft: 'bg-flame-soft', text: 'text-flame-d dark:text-warning', edge: 'shadow-[0_5px_0_var(--flame-d)]' },
  flag: { bg: 'bg-flag', soft: 'bg-flag-soft', text: 'text-flag-d dark:text-danger', edge: 'shadow-[0_5px_0_var(--flag-d)]' },
} as const;
type Tone = keyof typeof TONE;

/* ---------------------------------------------------------------- how it works */

function HowItWorks({ t }: { t: T }) {
  const steps: { mood: ArzinoMood; tone: Tone; n: 1 | 2 | 3 | 4 }[] = [
    { mood: 'reading', tone: 'flag', n: 1 },
    { mood: 'determined', tone: 'med', n: 2 },
    { mood: 'thinking', tone: 'flame', n: 3 },
    { mood: 'celebrate', tone: 'cedar', n: 4 },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:py-24">
      <SectionHead eyebrow={t('howEyebrow')} title={t('howTitle')} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08} className="h-full">
            <div className="chunky chunky-hover relative flex h-full flex-col rounded-[22px] p-5">
              <span className={cn('absolute end-4 top-4 flex size-9 items-center justify-center rounded-full font-display text-lg text-white', TONE[s.tone].bg)}>{s.n}</span>
              <div className={cn('flex h-40 items-end justify-center rounded-[16px]', TONE[s.tone].soft)}>
                <Arzino mood={s.mood} size={150} animate={false} />
              </div>
              <h3 className="mt-4 font-display text-xl">{t(`how.s${s.n}Title`)}</h3>
              <p className="mt-1 text-[15px] text-muted-foreground">{t(`how.s${s.n}Body`)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- game bento */

function GameBento({ t }: { t: T }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
      <SectionHead eyebrow={t('gameEyebrow')} title={t('gameTitle')} />
      <div className="mt-10 grid gap-4 md:grid-cols-6">
        <Reveal className="md:col-span-2">
          <Tile title={t('game.xpTitle')} body={t('game.xpBody')}>
            <p className="font-display text-5xl text-med">
              <bdi dir="ltr">+50 XP</bdi>
            </p>
            <div className="mt-3 h-4 overflow-hidden rounded-full bg-lock">
              <div className="bar-gloss h-full w-[78%] rounded-full bg-med" />
            </div>
            <p className="mt-1.5 text-end text-xs font-extrabold text-muted-foreground" dir="ltr">
              234 / 300
            </p>
          </Tile>
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.06}>
          <Tile title={t('game.streakTitle')} body={t('game.streakBody')}>
            <div className="flex items-center gap-3">
              <Arzino mood="streak-hug" size={84} animate={false} />
              <div>
                <p className="flex items-center gap-1 font-display text-5xl text-flame">
                  <Flame className="flame size-9 fill-flame" aria-hidden /> 7
                </p>
                <div className="mt-2 flex gap-1" aria-hidden>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <span key={i} className="size-3.5 rounded-full bg-flame shadow-[0_2px_0_var(--flame-d)]" />
                  ))}
                </div>
              </div>
            </div>
          </Tile>
        </Reveal>
        <Reveal className="md:col-span-2" delay={0.12}>
          <Tile title={t('game.mapTitle')} body={t('game.mapBody')}>
            <div className="flex items-center justify-between px-2 py-3" aria-hidden>
              <MapNode state="done" />
              <span className="h-1.5 flex-1 rounded-full bg-cedar" />
              <MapNode state="open" />
              <span className="h-1.5 flex-1 rounded-full bg-lock-d" />
              <MapNode state="locked" />
            </div>
          </Tile>
        </Reveal>
        <Reveal className="md:col-span-3" delay={0.06}>
          <Tile title={t('game.peerTitle')} body={t('game.peerBody')} tone="cedar">
            <div className="flex items-end gap-3">
              <ul className="flex-1 space-y-2" aria-hidden>
                {['w-[85%]', 'w-[70%]', 'w-[60%]'].map((w, i) => (
                  <li key={w} className="flex items-center gap-2 rounded-[12px] border-2 border-border bg-card px-3 py-2">
                    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-white', i < 2 ? 'bg-cedar' : 'bg-med')}>
                      <Check className="size-4" strokeWidth={3.5} />
                    </span>
                    <span className={cn('h-2.5 rounded-full bg-lock', w)} />
                  </li>
                ))}
              </ul>
              <Arzino mood="clipboard" size={110} animate={false} />
            </div>
          </Tile>
        </Reveal>
        <Reveal className="md:col-span-3" delay={0.12}>
          <Tile title={t('game.shameTitle')} body={t('game.shameBody')} tone="flame">
            <div className="flex items-end gap-3">
              <Arzino mood="try-again" size={110} animate={false} />
              <div className="relative mb-6 flex-1 rounded-[18px] rounded-es-md border-2 border-border bg-card px-4 py-3 font-display text-lg shadow-[0_4px_0_var(--border)]">
                {t('game.shameQuote')}
              </div>
            </div>
          </Tile>
        </Reveal>
      </div>
    </section>
  );
}

function Tile({ title, body, tone, children }: { title: string; body: string; tone?: Tone; children: React.ReactNode }) {
  return (
    <div className={cn('flex h-full flex-col justify-between gap-5 rounded-[22px] border-2 border-border p-5 shadow-[0_4px_0_var(--border)]', tone ? TONE[tone].soft : 'bg-card')}>
      <div>{children}</div>
      <div>
        <h3 className="font-display text-xl">{title}</h3>
        <p className="mt-0.5 text-[15px] text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function MapNode({ state }: { state: 'done' | 'open' | 'locked' }) {
  if (state === 'locked')
    return (
      <span className="flex size-14 items-center justify-center rounded-full bg-lock text-lock-d shadow-[0_5px_0_var(--lock-d)]">
        <Lock className="size-6 text-muted-foreground" />
      </span>
    );
  return (
    <span
      className={cn(
        'flex size-14 items-center justify-center rounded-full text-white',
        state === 'done' ? 'bg-sunny shadow-[0_5px_0_#d9a000]' : 'pulse-ring bg-cedar shadow-[0_5px_0_var(--cedar-d)] [--node-color:var(--cedar)]',
      )}
    >
      <Star className="size-7 fill-white" />
    </span>
  );
}

/* ---------------------------------------------------------------- meet arzino */

function MeetArzino({ t }: { t: T }) {
  const stickers: { mood: ArzinoMood; key: string }[] = [
    { mood: 'correct', key: 'correct' },
    { mood: 'thinking', key: 'thinking' },
    { mood: 'on-fire', key: 'onFire' },
    { mood: 'oops', key: 'oops' },
    { mood: 'streak-hug', key: 'streak' },
    { mood: 'cool', key: 'cool' },
    { mood: 'lebanese-pride', key: 'pride' },
    { mood: 'sleepy', key: 'sleepy' },
    { mood: 'trophy', key: 'trophy' },
    { mood: 'starry-eyed', key: 'starry' },
  ];
  const points = ['hints', 'voice', 'safe'] as const;
  return (
    <section id="arzino" className="scroll-mt-16 border-y-2 border-border bg-muted py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHead eyebrow={t('arzinoEyebrow')} title={t('arzinoTitle')} body={t('arzinoBody')} />
            <Reveal delay={0.1}>
              <ul className="mt-6 space-y-3">
                {points.map((p) => (
                  <li key={p} className="flex items-center gap-3 font-extrabold">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cedar text-white shadow-[0_3px_0_var(--cedar-d)]">
                      <Check className="size-5" strokeWidth={3.5} />
                    </span>
                    {t(`arzinoPoints.${p}`)}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-[26px] border-2 border-border bg-white shadow-[0_6px_0_var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static artwork, sized by its container */}
              <img src="/arzino/turnaround.webp" alt={t('arzinoTitle')} width={1600} height={900} loading="lazy" className="block h-auto w-full" />
            </div>
          </Reveal>
        </div>
        <div className="mt-12 grid grid-cols-5 gap-x-2 gap-y-5 sm:gap-4 lg:grid-cols-10">
          {stickers.map((s, i) => (
            <Reveal key={s.key} delay={i * 0.04} y={14}>
              <Wiggle className="flex cursor-default flex-col items-center gap-1 text-center">
                <Arzino mood={s.mood} size={84} animate={false} className="size-[60px]! sm:size-[84px]!" />
                <span className="text-xs font-extrabold text-muted-foreground sm:text-sm">{t(`stickers.${s.key}`)}</span>
              </Wiggle>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- campus */

function Campus({ t }: { t: T }) {
  const features: { mood: ArzinoMood; tone: Tone; key: 'walk' | 'study' | 'exam' }[] = [
    { mood: 'cool', tone: 'cedar', key: 'walk' },
    { mood: 'streak-buddy', tone: 'med', key: 'study' },
    { mood: 'teaching', tone: 'flag', key: 'exam' },
  ];
  return (
    <section id="campus" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:py-24">
      <SectionHead eyebrow={t('campusEyebrow')} title={t('campusTitle')} body={t('campusBody')} />
      <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Reveal>
          <CampusScene t={t} />
        </Reveal>
        <div className="space-y-4">
          {features.map((f, i) => (
            <Reveal key={f.key} delay={i * 0.08}>
              <div className="chunky flex items-center gap-4 rounded-[22px] p-4">
                <div className={cn('flex size-[88px] shrink-0 items-end justify-center rounded-[18px]', TONE[f.tone].soft)}>
                  <Arzino mood={f.mood} size={84} animate={false} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-xl">{t(`campus.${f.key}Title`)}</h3>
                  <p className="mt-0.5 text-[15px] text-muted-foreground">{t(`campus.${f.key}Body`)}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CampusScene({ t }: { t: T }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border-2 border-border shadow-[0_6px_0_var(--border)]" aria-hidden>
      {/* floor */}
      <div className="absolute inset-0 bg-card" style={{ backgroundImage: 'repeating-conic-gradient(var(--cedar-soft) 0 25%, transparent 0 50%)', backgroundSize: '56px 56px' }} />
      {/* wall with two glowing doors */}
      <div className="absolute inset-x-0 top-0 flex h-[30%] items-end justify-around border-b-4 border-cedar-d bg-cedar px-6">
        <Door label={t('campus.studyDoor')} tone="med" />
        <Door label={t('campus.examDoor')} tone="flag" />
      </div>
      {/* people */}
      <Person initial="L" tone="cedar" label={t('campus.you')} className="start-[16%] top-[56%]" />
      <Person initial="K" tone="med" className="end-[26%] top-[42%]" />
      <Person initial="O" tone="flame" className="end-[10%] top-[70%]" />
      <FloatChip className="end-[8%] top-[35%]" delay={0.2} amplitude={5}>
        <span className="chunky rounded-[14px] rounded-es-sm px-2.5 py-1 text-sm font-extrabold">{t('campus.wave')}</span>
      </FloatChip>
      <div className="absolute bottom-1 start-[42%]">
        <Arzino mood="welcome" size={110} className="size-[78px]! sm:size-[110px]!" />
      </div>
    </div>
  );
}

function Door({ label, tone }: { label: string; tone: Tone }) {
  return (
    <div className="flex flex-col items-center">
      <span className="mb-1.5 rounded-full bg-card px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-foreground shadow-[0_2px_0_var(--border)] sm:text-xs">{label}</span>
      <div
        className={cn('h-12 w-11 rounded-t-[14px] border-[3px] border-white/80 sm:h-16 sm:w-14', TONE[tone].bg)}
        style={{ boxShadow: `0 0 26px 6px color-mix(in srgb, var(--${tone}) 60%, transparent)` }}
      />
    </div>
  );
}

function Person({ initial, tone, label, className }: { initial: string; tone: Tone; label?: string; className?: string }) {
  return (
    <div className={cn('absolute flex flex-col items-center', className)}>
      <span className={cn('flex size-10 items-center justify-center rounded-full border-[3px] border-white font-display text-white sm:size-12', TONE[tone].bg, TONE[tone].edge)}>{initial}</span>
      {label && <span className="mt-1 rounded-full bg-ink px-2 text-[11px] font-black text-white">{label}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- roles */

function Roles({ t }: { t: T }) {
  const roles: { key: 'student' | 'teacher' | 'parent' | 'school'; tone: Tone; mood: ArzinoMood }[] = [
    { key: 'student', tone: 'cedar', mood: 'cheer' },
    { key: 'teacher', tone: 'med', mood: 'teaching' },
    { key: 'parent', tone: 'flame', mood: 'warm' },
    { key: 'school', tone: 'flag', mood: 'clipboard' },
  ];
  return (
    <section id="roles" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 md:pb-24">
      <SectionHead eyebrow={t('rolesEyebrow')} title={t('rolesTitle')} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((r, i) => (
          <Reveal key={r.key} delay={i * 0.07} className="h-full">
            <div className="chunky chunky-hover flex h-full flex-col overflow-hidden rounded-[22px]">
              <div className={cn('relative flex h-48 items-end justify-center overflow-hidden', TONE[r.tone].bg)}>
                <div className="absolute -bottom-16 size-56 rounded-full bg-white/15" aria-hidden />
                <Arzino mood={r.mood} size={170} animate={false} className="relative" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <span className={cn('eyebrow self-start rounded-full px-2.5 py-0.5 text-white!', TONE[r.tone].bg)}>{t(`roles.${r.key}`)}</span>
                <h3 className="mt-3 font-display text-xl leading-tight">{t(`roles.${r.key}Title`)}</h3>
                <p className="mt-1 text-[15px] text-muted-foreground">{t(`roles.${r.key}Body`)}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- vision */

function Vision({ t }: { t: T }) {
  const rows = ['A', 'B', 'C', 'D'] as const;
  return (
    <section id="vision" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 md:pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] bg-cedar p-7 text-white shadow-[0_8px_0_var(--cedar-d)] dark:bg-cedar-d md:p-12">
          <span className="pointer-events-none absolute -end-6 -top-10 select-none font-display text-[160px] leading-none text-white/10 md:text-[240px]" aria-hidden>
            2036
          </span>
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="eyebrow text-white/80!">{t('visionEyebrow')}</p>
              <h2 className="mt-2 max-w-xl font-display text-3xl leading-tight md:text-5xl">{t('visionTitle')}</h2>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {rows.map((r) => (
                  <li key={r} className="flex flex-wrap items-center gap-2 rounded-[18px] bg-white/10 p-3">
                    <span className="font-bold text-white/85 line-through decoration-2">{t(`vision.from${r}`)}</span>
                    <ArrowRight className="rtl-flip size-5 shrink-0 text-white/70" aria-hidden />
                    <span className="rounded-full bg-white px-3 py-1 font-display text-[15px] text-cedar-ink">{t(`vision.to${r}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mx-auto">
              <Arzino mood="lebanese-pride" size={300} className="size-[220px]! md:size-[300px]!" />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- roadmap */

function Roadmap({ t }: { t: T }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
      <Reveal>
        <div className="chunky flex flex-col gap-5 rounded-[24px] p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Arzino mood="proud" size={72} animate={false} />
            <h2 className="font-display text-2xl">{t('roadmapTitle')}</h2>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 lg:shrink-0 lg:flex-nowrap">
            <RoadPill done label={t('roadmapClassroom')} tag={t('available')} />
            <ArrowRight className="rtl-flip hidden size-5 text-lock-d sm:block" aria-hidden />
            <RoadPill label={t('roadmapTeams')} tag={t('next')} />
            <ArrowRight className="rtl-flip hidden size-5 text-lock-d sm:block" aria-hidden />
            <RoadPill label={t('roadmapLti')} tag={t('next')} />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function RoadPill({ label, tag, done }: { label: string; tag: string; done?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-2 font-extrabold',
        done ? 'border-cedar bg-cedar-soft text-cedar-ink dark:text-white' : 'border-dashed border-lock-d text-muted-foreground',
      )}
    >
      {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Clock className="size-4" aria-hidden />}
      <span dir="ltr">{label}</span>
      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wider', done ? 'bg-cedar text-white' : 'bg-flame-soft text-flame-d dark:text-warning')}>{tag}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- final CTA */

function FinalCta({ t }: { t: T }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] border-2 border-border bg-cedar-soft px-6 py-12 text-center shadow-[0_6px_0_var(--border)] md:py-16">
          <div className="pointer-events-none absolute -start-6 bottom-0 hidden md:block">
            <Arzino mood="fireworks" size={220} />
          </div>
          <div className="pointer-events-none absolute -end-4 bottom-0 hidden md:block">
            <Arzino mood="party" size={220} />
          </div>
          <div className="mx-auto mb-2 md:hidden">
            <Arzino mood="party" size={170} />
          </div>
          <h2 className="mx-auto max-w-xl font-display text-[34px] leading-tight md:text-5xl">{t('ctaTitle')}</h2>
          <p className="mx-auto mt-3 max-w-md text-lg text-muted-foreground">{t('ctaBody')}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="kid" size="lg" className="w-full sm:w-auto">
              <Link href="/login">
                <span className="flex size-7 items-center justify-center rounded-full bg-white">
                  <GoogleG className="size-[18px]!" />
                </span>
                {t('getStarted')}
              </Link>
            </Button>
            <Button asChild variant="kidGhost" size="lg" className="w-full sm:w-auto">
              <Link href="/login#demo">
                {t('ctaDemo')} <ArrowRight className="rtl-flip" />
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- footer */

function Footer({ t }: { t: T }) {
  return (
    <footer className="border-t-2 border-border bg-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Arzino mood="welcome" size={56} animate={false} />
          <div>
            <Logo small />
            <p className="mt-1 text-sm font-bold text-muted-foreground">{t('footerTag')}</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-extrabold text-muted-foreground" aria-label="Footer">
          <a href="#how" className="hover:text-foreground">{t('nav.how')}</a>
          <a href="#arzino" className="hover:text-foreground">{t('nav.arzino')}</a>
          <a href="#campus" className="hover:text-foreground">{t('nav.campus')}</a>
          <Link href="/login" className="hover:text-foreground">{t('logIn')}</Link>
        </nav>
        <div className="text-sm text-muted-foreground md:text-end">
          <p className="font-bold">{t('footer')}</p>
          <p>{t('madeIn')}</p>
        </div>
      </div>
    </footer>
  );
}
