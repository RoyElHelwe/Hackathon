'use client';

import { Share2, Settings } from 'lucide-react';
import { useFormatter, useNow, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Arzino } from '@/components/arzino';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { BadgeCard } from '@/components/kid/celebrations';
import { LevelRing, XpBar } from '@/components/kid/stats';
import { subjectStyle } from '@/components/student/subject-style';
import { Button } from '@/components/ui/button';
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

  // Last 28 days for the streak calendar (4 rows of 7)
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86400_000);
    return d.toISOString().slice(0, 10);
  });
  const active = new Set(g.activeDays);
  const today = days[days.length - 1];
  const earned = g.badges.filter((b) => b.earned).length;
  const stats = [
    { label: t('statStreak'), value: g.streak.current, cls: 'text-flame-d dark:text-flame' },
    { label: t('statXp'), value: g.xp, cls: 'text-med-ink dark:text-med' },
    { label: t('statLevel'), value: g.level.level, cls: 'text-cedar-ink dark:text-cedar' },
    { label: t('statWallet'), value: g.wallet, cls: 'text-flag-d dark:text-danger' },
  ];

  return (
    <div className="space-y-7">
      {/* Who */}
      <div className="flex items-center gap-4">
        <Avatar name={me?.user.name ?? ''} src={me?.user.avatarUrl} className="size-20 border-4 border-card text-3xl shadow-[0_4px_0_var(--border)] sm:size-24" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[30px] font-black leading-tight">{me?.user.name}</h1>
          <p className="truncate font-bold text-muted-foreground">{me?.active?.schoolName}</p>
        </div>
        <Link href="/settings" className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border-2 border-border text-muted-foreground shadow-[0_3px_0_var(--border)] hover:bg-muted" aria-label={tc('settings')}>
          <Settings className="size-5" />
        </Link>
      </div>

      {/* Big numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="chunky rounded-[18px] px-4 py-3">
            <p className={cn('font-display text-3xl font-black tabular-nums', st.cls)}>{st.value}</p>
            <p className="text-sm font-extrabold text-muted-foreground">{st.label}</p>
          </div>
        ))}
      </div>

      <div className="chunky flex items-center gap-4 rounded-[20px] p-4">
        <LevelRing level={g.level.level} progress={g.level.progress} />
        <XpBar progress={g.level.progress} xp={g.xp} nextLevelXp={g.level.nextLevelXp} className="min-w-0 flex-1" />
      </div>

      {/* Streak: flame block + calendar */}
      <section className="space-y-3">
        <div className="relative flex items-center gap-3 overflow-hidden rounded-[24px] bg-flame p-4 text-white shadow-[0_6px_0_var(--flame-d)] sm:p-5">
          <Arzino mood={g.streak.current >= 3 ? 'on-fire' : g.streak.current > 0 ? 'streak-buddy' : 'streak-small'} size={120} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[56px] font-black leading-none">{g.streak.current}</p>
            <p className="font-display text-2xl font-black leading-tight">{t('dayStreak')}</p>
            <p className="mt-1 text-sm font-bold text-white/90">{g.streak.current > 0 ? t('streakKeep') : t('streakStart')}</p>
          </div>
        </div>
        <div className="chunky rounded-[20px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="eyebrow">{t('streakCalendar')}</h2>
            <span className="text-sm font-black text-flame-d dark:text-flame">🏆 {t('longest', { days: g.streak.longest })}</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2" dir="ltr">
            {days.map((d) => (
              <div
                key={d}
                title={d}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-full text-sm font-black',
                  active.has(d) ? 'bg-flame text-white shadow-[0_3px_0_var(--flame-d)]' : 'text-muted-foreground',
                  d === today && !active.has(d) && 'border-2 border-flame text-flame-d',
                )}
              >
                {new Date(d).getUTCDate()}
              </div>
            ))}
          </div>
        </div>
      </section>

      {g.subjects.length > 0 && (
        <section className="chunky space-y-4 rounded-[20px] p-5">
          <h2 className="eyebrow">{t('subjectLevels')}</h2>
          {g.subjects.map((s) => {
            const ss = subjectStyle(s.key, s.color, s.icon);
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] text-xl" style={{ background: ss.hex, boxShadow: `0 4px 0 ${ss.hexD}` }}>
                  {ss.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-sm font-black">
                    <span className="truncate">{l(s.name)}</span>
                    <span className={ss.text}>
                      {t('level')} {s.level.level}
                    </span>
                  </div>
                  <Progress value={s.level.progress * 100} barClassName={ss.bg} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Badges with Arzino art */}
      <section>
        <div className="mb-3 flex items-end gap-3">
          <Arzino mood="trophy" size={84} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-black leading-tight">
              {t('badges')} <span className="text-base text-muted-foreground">· {earned}/{g.badges.length}</span>
            </h2>
            <p className="text-sm font-bold text-muted-foreground">{t('badgesSub')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="badge-grid">
          {[...g.badges].sort((a, b) => Number(b.earned) - Number(a.earned)).map((b) => (
            <BadgeCard key={b.key} icon={b.icon} name={b.name} earned={b.earned} badgeKey={b.key} />
          ))}
        </div>
      </section>

      <section className="chunky rounded-[20px] p-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🪙
          </span>
          <div>
            <h2 className="font-display text-xl font-black">{t('wallet')}</h2>
            <p className="text-sm font-bold text-muted-foreground">{t('walletHelp')}</p>
          </div>
        </div>
        <ul className="mt-3 divide-y-2 divide-border">
          {g.walletTxs.slice(0, 6).map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm font-bold">
              <span className="min-w-0 truncate">{t.has(`walletReasons.${tx.reason}`) ? t(`walletReasons.${tx.reason}`) : tx.reason}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground">{format.relativeTime(new Date(tx.createdAt), now)}</span>
                <span className={cn('font-black', tx.delta > 0 ? 'text-cedar-ink dark:text-cedar' : 'text-flag-d dark:text-danger')}>
                  {tx.delta > 0 ? '+' : ''}
                  {tx.delta} 🪙
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Family: warm flame tones (parent color) */}
      <section className="rounded-[24px] border-2 border-flame/40 bg-flame-soft p-5">
        <div className="flex items-center gap-3">
          <Arzino mood="warm" size={96} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-black">{t('inviteFamily')}</h2>
            <p className="text-sm font-bold text-muted-foreground">{t('inviteFamilyBody')}</p>
          </div>
        </div>
        {code ? (
          <div className="mt-4 rounded-[20px] border-2 border-border bg-card p-4 text-center shadow-[0_4px_0_var(--border)]">
            <p className="eyebrow">{t('familyCodeTitle')}</p>
            <p className="mt-1 font-display text-5xl font-black tracking-[0.25em] text-flame-d dark:text-flame" dir="ltr" data-testid="family-code">
              {code.code}
            </p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">{t('codeValid')}</p>
            <Button variant="kidSunny" className="mt-3" onClick={share}>
              <Share2 /> {copied ? tc('copied') : tc('share')}
            </Button>
          </div>
        ) : (
          <Button variant="kidSunny" size="lg" className="mt-4 w-full" onClick={makeCode} loading={busy} data-testid="make-family-code">
            {t('makeCode')}
          </Button>
        )}
        {err && <p className="mt-2 font-bold text-flag-d dark:text-danger">{err}</p>}
      </section>
      <p className="text-center text-xs font-bold text-muted-foreground" lang={locale}>
        Tajriba · {me?.user.email}
      </p>
    </div>
  );
}
