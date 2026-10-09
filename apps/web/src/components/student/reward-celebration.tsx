'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Arzino } from '@/components/arzino';
import { BadgeCard, fireConfetti, FloatingXp, LevelUpModal } from '@/components/kid/celebrations';
import { useSound } from '@/components/app/theme';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useInvalidate, useL } from '@/lib/hooks';
import type { Rewards } from '@/lib/types';

/**
 * Plays the reward sequence once: "+XP" float → badge flip → level-up modal.
 * Marks the SUBMISSION_VALIDATED notification as read so it only plays once.
 */
export function RewardCelebration({ rewards, onDone }: { rewards: Rewards; onDone?: () => void }) {
  const t = useTranslations('student');
  const l = useL();
  const sound = useSound();
  const invalidate = useInvalidate();
  const [phase, setPhase] = useState<'xp' | 'badge' | 'level' | 'done'>('xp');
  const started = useRef(false);

  useEffect(() => {
    // One-time side effects (StrictMode runs effects twice), but always (re)schedule the timer.
    if (!started.current) {
      started.current = true;
      fireConfetti();
      sound('coin');
      if (rewards.notificationId) api(`/notifications/${rewards.notificationId}/read`, { method: 'POST' }).catch(() => undefined);
    }
    const timer = setTimeout(() => setPhase(rewards.newBadges.length ? 'badge' : rewards.levelAfter > rewards.levelBefore ? 'level' : 'done'), 1900);
    return () => clearTimeout(timer);
  }, [rewards, sound]);

  const afterBadge = () => setPhase(rewards.levelAfter > rewards.levelBefore ? 'level' : 'done');

  useEffect(() => {
    if (phase === 'done') {
      invalidate('/gamification/me', '/notifications');
      onDone?.();
    }
  }, [phase, invalidate, onDone]);

  return (
    <>
      <FloatingXp amount={rewards.xpGained} show={phase === 'xp'} />
      <AnimatePresence>
        {phase === 'badge' && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="badge-earned">
            <motion.div
              initial={{ y: 40, scale: 0.85 }}
              animate={{ y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[28px] border-2 border-border bg-card p-6 text-center shadow-[0_8px_0_0_var(--border)]"
            >
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#FFF5D6] to-transparent dark:from-[#3b3212]" aria-hidden />
              <p className="eyebrow relative !text-flame-d dark:!text-flame">🏅 {t('newBadge')}</p>
              <div className="relative mx-auto mt-4 grid max-w-[220px] gap-3" style={{ perspective: 800 }}>
                {rewards.newBadges.map((b) => (
                  <BadgeCard key={b.key} icon={b.icon} name={b.name} badgeKey={b.key} flip />
                ))}
              </div>
              <Button variant="kid" size="lg" className="relative mt-6 w-full" onClick={afterBadge}>
                {t('awesome')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <LevelUpModal level={rewards.levelAfter} open={phase === 'level'} onClose={() => setPhase('done')} />
      {phase === 'done' && rewards.unlockedTopics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-[20px] border-2 border-[#FFC21A] bg-[#FFF5D6] p-4 text-ink shadow-[0_4px_0_#E0A800] dark:bg-[#3b3212] dark:text-white"
          data-testid="unlocked-topic"
        >
          <Arzino mood="shocked" size={72} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-black leading-tight">{t('unlocked', { name: l(rewards.unlockedTopics[0].name) })}</p>
            <Button asChild variant="kidSunny" size="sm" className="mt-2">
              <Link href={`/student/map?unlocked=${rewards.unlockedTopics.map((u) => u.id).join(',')}`}>{t('seeMap')}</Link>
            </Button>
          </div>
        </motion.div>
      )}
    </>
  );
}
