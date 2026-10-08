'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="badge-earned">
            <motion.div initial={{ y: 30 }} animate={{ y: 0 }} className="w-full max-w-xs rounded-[28px] bg-card p-6 text-center shadow-2xl">
              <p className="mb-4 font-display text-2xl font-extrabold text-primary">{t('newBadge')}</p>
              <div className="mx-auto grid max-w-[180px] gap-3" style={{ perspective: 800 }}>
                {rewards.newBadges.map((b) => (
                  <BadgeCard key={b.key} icon={b.icon} name={b.name} flip />
                ))}
              </div>
              <Button variant="kid" size="pill" className="mt-6 w-full" onClick={afterBadge}>
                {t('awesome')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <LevelUpModal level={rewards.levelAfter} open={phase === 'level'} onClose={() => setPhase('done')} />
      {phase === 'done' && rewards.unlockedTopics.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[20px] border-2 border-sunny bg-sunny-soft p-4 text-center" data-testid="unlocked-topic">
          <p className="font-display text-lg font-extrabold">{t('unlocked', { name: l(rewards.unlockedTopics[0].name) })}</p>
          <Button asChild variant="kidSunny" className="mt-3">
            <Link href={`/student/map?unlocked=${rewards.unlockedTopics.map((u) => u.id).join(',')}`}>{t('seeMap')}</Link>
          </Button>
        </motion.div>
      )}
    </>
  );
}
