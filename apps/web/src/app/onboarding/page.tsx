'use client';

import { GraduationCap, Heart, School, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BouslaSays, Bousla } from '@/components/bousla';
import { FamilyKeypad } from '@/components/app/family-keypad';
import { LanguageSwitch } from '@/components/app/locale';
import { Logo } from '@/components/app/logo';
import { PageSkeleton } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { cn } from '@/lib/cn';

type Mode = null | 'create' | 'join' | 'child' | 'student';

export default function Onboarding() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { data: me, isLoading, error, refetch } = useMe();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: '', code: '' });
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace('/login?next=/onboarding');
    else if (me?.active) router.replace(me.home);
  }, [me, error, router]);

  if (isLoading || !me || me.active) return <PageSkeleton />;
  const pendingMembership = me.memberships.find((m) => m.status === 'PENDING');

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

  const options = [
    { id: 'create' as const, icon: School, title: t('createSchool'), body: t('createSchoolBody'), color: 'bg-violet-soft' },
    { id: 'join' as const, icon: GraduationCap, title: t('joinSchool'), body: t('joinSchoolBody'), color: 'bg-mint-soft' },
    { id: 'child' as const, icon: Heart, title: t('linkChild'), body: t('linkChildBody'), color: 'bg-coral-soft' },
    { id: 'student' as const, icon: Sparkles, title: t('imStudent'), body: t('imStudentBody'), color: 'bg-sunny-soft' },
  ];

  return (
    <div className="min-h-dvh bg-background bg-dots">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Logo />
        <LanguageSwitch />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        {pending || pendingMembership ? (
          <div className="flex flex-col items-center gap-3 pt-10 text-center">
            <Bousla mood="happy" size={130} />
            <h1 className="font-display text-3xl font-extrabold">{t('pendingTitle')}</h1>
            <p className="text-muted-foreground">{t('pendingBody', { school: pending ?? pendingMembership?.school.name ?? '' })}</p>
            <Button variant="outline" onClick={() => refetch()}>
              ↻
            </Button>
          </div>
        ) : (
          <>
            <BouslaSays mood="curious" size={80}>
              {t('onboardingSubtitle', { name: me.user.name.split(' ')[0] })}
            </BouslaSays>
            <h1 className="mt-4 font-display text-3xl font-extrabold">{t('onboardingTitle')}</h1>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setMode(o.id);
                    setErr(null);
                  }}
                  className={cn('rounded-[20px] border-2 p-5 text-start transition-all', o.color, mode === o.id ? 'border-primary shadow-lg' : 'border-transparent')}
                  data-testid={`onboard-${o.id}`}
                >
                  <o.icon className="size-7 text-primary" />
                  <p className="mt-2 font-display text-xl font-extrabold">{o.title}</p>
                  <p className="text-sm text-muted-foreground">{o.body}</p>
                </button>
              ))}
            </div>

            {mode && (
              <Card className="mt-6 p-6">
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
                    <div>
                      <Label htmlFor="sname">{t('schoolName')}</Label>
                      <Input id="sname" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="city">{t('city')}</Label>
                      <Input id="city" required minLength={2} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <Button type="submit" loading={busy} className="w-full">
                      {t('create')}
                    </Button>
                  </form>
                )}
                {(mode === 'join' || mode === 'student') && (
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        const r = await api<{ school: { name: string }; membership: { status: string } }>('/schools/join', {
                          body: { code: form.code, role: mode === 'join' ? 'TEACHER' : 'STUDENT' },
                        });
                        setPending(r.school.name);
                        refetch();
                      });
                    }}
                  >
                    {mode === 'student' && <p className="text-sm text-muted-foreground">{t('imStudentBody')}</p>}
                    <div>
                      <Label htmlFor="code">{t('schoolCode')}</Label>
                      <Input id="code" required placeholder="TRP-2036" dir="ltr" className="font-mono uppercase tracking-widest" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                    </div>
                    <Button type="submit" loading={busy} className="w-full">
                      {t('join')}
                    </Button>
                  </form>
                )}
                {mode === 'child' && (
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
                )}
                {err && <p className="mt-4 rounded-[14px] bg-coral-soft p-3 text-center font-semibold text-danger">{err}</p>}
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
