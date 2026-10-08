'use client';

import { Share2, Settings } from 'lucide-react';
import { useFormatter, useNow, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { BadgeCard } from '@/components/kid/celebrations';
import { Coins, LevelRing, StreakFlame, XpBar } from '@/components/kid/stats';
import { subjectStyle } from '@/components/student/subject-style';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, Progress } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useL, useMe } from '@/lib/hooks';
import type { Gamification } from '@/lib/types';

export default function MePage() {
  const t = useTranslations('student');
  const tc = useTranslations('common');
  const l = useL();
  const locale = useLocale();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { data: me } = useMe();
  const { data: g, isLoading, error, refetch } = useApi<Gamification>('/gamification/me');
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (error || !g) return <ErrorState onRetry={() => refetch()} />;

  const makeCode = async () => {
    setBusy(true);
    setErr(null);
    try {
      setCode(await api('/families/code', { method: 'POST' }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    if (!code) return;
    const text = t('shareText', { code: code.code });
    if (navigator.share) await navigator.share({ title: 'Tajriba', text }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    }
  };

  // Last 28 days for the streak calendar
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86400_000);
    return d.toISOString().slice(0, 10);
  });
  const active = new Set(g.activeDays);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={me?.user.name ?? ''} src={me?.user.avatarUrl} className="size-20 border-4 border-white text-2xl shadow-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-extrabold">{me?.user.name}</h1>
          <p className="text-muted-foreground">{me?.active?.schoolName}</p>
        </div>
        <Link href="/settings" className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label={tc('settings')}>
          <Settings className="size-6" />
        </Link>
      </div>

      <Card className="flex items-center gap-4 p-4">
        <LevelRing level={g.level.level} progress={g.level.progress} />
        <div className="min-w-0 flex-1 space-y-3">
          <XpBar progress={g.level.progress} xp={g.xp} nextLevelXp={g.level.nextLevelXp} />
          <div className="flex gap-2">
            <StreakFlame days={g.streak.current} />
            <Coins points={g.wallet} />
          </div>
        </div>
      </Card>

      {g.subjects.length > 0 && (
        <Card className="space-y-3 p-5">
          <h2 className="font-display text-xl font-extrabold">{t('subjectLevels')}</h2>
          {g.subjects.map((s) => (
            <div key={s.key} className="flex items-center gap-3">
              <span className={cn('flex size-10 items-center justify-center rounded-[12px] text-xl', subjectStyle(s.key).soft)}>{subjectStyle(s.key).emoji}</span>
              <div className="flex-1">
                <div className="flex justify-between text-sm font-bold">
                  <span>{l(s.name)}</span>
                  <span>
                    {t('level')} {s.level.level}
                  </span>
                </div>
                <Progress value={s.level.progress * 100} barClassName={subjectStyle(s.key).bg} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 font-display text-xl font-extrabold">{t('badges')}</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" data-testid="badge-grid">
          {g.badges.map((b) => (
            <BadgeCard key={b.key} icon={b.icon} name={b.name} earned={b.earned} size="sm" />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">{t('streakCalendar')}</h2>
          <span className="text-sm font-bold text-muted-foreground">{t('longest', { days: g.streak.longest })}</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5" dir="ltr">
          {days.map((d) => (
            <div key={d} title={d} className={cn('flex aspect-square items-center justify-center rounded-[10px] text-xs font-bold', active.has(d) ? 'bg-coral text-white' : 'bg-muted text-muted-foreground')}>
              {active.has(d) ? '🔥' : new Date(d).getUTCDate()}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl font-extrabold">{t('wallet')}</h2>
        <p className="text-sm text-muted-foreground">{t('walletHelp')}</p>
        <ul className="mt-3 divide-y divide-border">
          {g.walletTxs.slice(0, 6).map((tx) => (
            <li key={tx.id} className="flex items-center justify-between py-2 text-sm">
              <span>{t.has(`walletReasons.${tx.reason}`) ? t(`walletReasons.${tx.reason}`) : tx.reason}</span>
              <span className="flex items-center gap-3">
                <span className="text-muted-foreground">{format.relativeTime(new Date(tx.createdAt), now)}</span>
                <span className={cn('font-extrabold', tx.delta > 0 ? 'text-success' : 'text-danger')}>
                  {tx.delta > 0 ? '+' : ''}
                  {tx.delta} 🪙
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-2 border-coral/40 bg-coral-soft p-5">
        <h2 className="font-display text-xl font-extrabold">👨‍👩‍👧 {t('inviteFamily')}</h2>
        <p className="text-sm">{t('inviteFamilyBody')}</p>
        {code ? (
          <div className="mt-4 text-center">
            <p className="font-display text-5xl font-extrabold tracking-[0.3em]" dir="ltr" data-testid="family-code">
              {code.code}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t('codeValid')}</p>
            <Button variant="kidCoral" className="mt-3" onClick={share}>
              <Share2 /> {copied ? tc('copied') : tc('share')}
            </Button>
          </div>
        ) : (
          <Button variant="kidCoral" className="mt-4 w-full" onClick={makeCode} loading={busy} data-testid="make-family-code">
            {t('makeCode')}
          </Button>
        )}
        {err && <p className="mt-2 font-semibold text-danger">{err}</p>}
      </Card>
      <p className="text-center text-xs text-muted-foreground" lang={locale}>
        Tajriba · {me?.user.email}
      </p>
    </div>
  );
}
