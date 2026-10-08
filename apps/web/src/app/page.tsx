import { ArrowRight, Check, Clock } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Bousla } from '@/components/bousla';
import { LanguageSwitch } from '@/components/app/locale';
import { Logo } from '@/components/app/logo';
import { Button } from '@/components/ui/button';

export default async function Landing() {
  const t = await getTranslations('landing');
  const features = [
    { emoji: '🌍', title: t('f1Title'), body: t('f1Body'), color: 'bg-mint-soft' },
    { emoji: '🚀', title: t('f2Title'), body: t('f2Body'), color: 'bg-violet-soft' },
    { emoji: '🤝', title: t('f3Title'), body: t('f3Body'), color: 'bg-sunny-soft' },
  ];
  const steps = [t('how1'), t('how2'), t('how3'), t('how4'), t('how5')];
  const roles = [
    { emoji: '🧒', text: t('roleStudent') },
    { emoji: '👩‍🏫', text: t('roleTeacher') },
    { emoji: '👪', text: t('roleParent') },
    { emoji: '🏫', text: t('roleDirector') },
  ];
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">{t('signIn')}</Link>
          </Button>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.2fr_1fr] md:pt-16">
        <div className="absolute -top-20 end-0 -z-10 size-[420px] rounded-full bg-violet/15 blur-3xl" />
        <div className="absolute bottom-0 start-10 -z-10 size-[300px] rounded-full bg-mint/20 blur-3xl" />
        <div>
          <span className="inline-flex rounded-full bg-violet-soft px-4 py-1.5 text-sm font-bold text-primary dark:text-white">{t('badge')}</span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            {t('heroTitle').split('—')[0]}
            <span className="block bg-gradient-to-r from-violet via-sky to-mint bg-clip-text text-transparent">{t('heroTitle').split('—')[1]}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t('heroBody')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="kid" size="pill" data-testid="cta-signin">
              <Link href="/login">
                <GoogleG /> {t('signIn')}
              </Link>
            </Button>
            <Button asChild variant="kidGhost" size="pill">
              <Link href="/login#demo">
                {t('tryDemo')} <ArrowRight className="rtl-flip" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto">
          <div className="absolute inset-0 -z-10 m-auto size-72 rounded-full bg-gradient-to-br from-sunny/50 to-coral/30 blur-2xl" />
          <Bousla mood="cheering" size={300} />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-16 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className={`rounded-[24px] ${f.color} p-6`}>
            <div className="text-4xl" aria-hidden>
              {f.emoji}
            </div>
            <h2 className="mt-3 font-display text-2xl font-extrabold">{f.title}</h2>
            <p className="mt-2 text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-3xl font-extrabold">{t('howTitle')}</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-[20px] border border-border bg-card p-4 sm:flex-col sm:text-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-extrabold text-white">{i + 1}</span>
              <span className="font-bold">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-3xl font-extrabold">{t('rolesTitle')}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r) => (
            <div key={r.text} className="rounded-[20px] border border-border bg-card p-5">
              <div className="text-3xl" aria-hidden>
                {r.emoji}
              </div>
              <p className="mt-2 font-semibold">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-[28px] bg-ink p-8 text-white">
          <h2 className="font-display text-2xl font-extrabold">{t('roadmapTitle')}</h2>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Pill done label={t('roadmapClassroom')} tag={t('available')} />
            <span className="text-white/40">→</span>
            <Pill label={t('roadmapTeams')} tag={t('next')} />
            <span className="text-white/40">→</span>
            <Pill label={t('roadmapLti')} tag={t('next')} />
          </div>
        </div>
      </section>
      <footer className="pb-10 text-center text-sm text-muted-foreground">{t('footer')}</footer>
    </div>
  );
}

function Pill({ label, tag, done }: { label: string; tag: string; done?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold ${done ? 'bg-mint text-ink' : 'bg-white/10'}`}>
      {done ? <Check className="size-4" /> : <Clock className="size-4" />}
      {label}
      <span className="rounded-full bg-black/15 px-2 text-xs">{tag}</span>
    </span>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 rounded-full bg-white p-0.5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
