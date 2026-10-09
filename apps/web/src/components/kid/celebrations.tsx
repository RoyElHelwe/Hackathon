'use client';

import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Arzino, type ArzinoMood } from '@/components/arzino';
import { Button } from '@/components/ui/button';
import { useSound } from '@/components/app/theme';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { I18nText } from '@tajriba/shared';

/** Lebanon confetti: cedar, flag red, white, Mediterranean blue, a pinch of flame and gold. */
const CONFETTI = ['#00A651', '#E4252D', '#FFFFFF', '#1C8BE0', '#FF9600', '#FFC21A', '#58CC02'];

export function fireConfetti(strong = false) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = CONFETTI;
  confetti({ particleCount: strong ? 170 : 100, spread: strong ? 110 : 75, origin: { y: 0.6 }, colors, scalar: 1.15 });
  if (strong) {
    setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 65, origin: { x: 0, y: 0.7 }, colors }), 250);
    setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors }), 420);
    setTimeout(() => confetti({ particleCount: 60, spread: 360, startVelocity: 28, origin: { y: 0.35 }, colors, shapes: ['star'], scalar: 1.4 }), 700);
  }
}

/** "+50 XP" floating up. */
export function FloatingXp({ amount, show }: { amount: number; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], y: -80, scale: [0.6, 1.35, 1.2] }}
          transition={{ duration: 1.9, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-1 font-display text-5xl font-black text-med drop-shadow-[0_3px_0_var(--med-d)]"
          data-testid="floating-xp"
        >
          <svg viewBox="0 0 24 24" className="size-11" aria-hidden>
            <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.6L13.5 2Z" fill="var(--med)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          +{amount} XP
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LevelUpModal({ level, open, onClose }: { level: number; open: boolean; onClose: () => void }) {
  const t = useTranslations('student');
  const sound = useSound();
  useEffect(() => {
    if (open) {
      fireConfetti(true);
      sound('levelup');
    }
  }, [open, sound]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal
          data-testid="level-up"
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -8, y: 40 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 170, damping: 12 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[28px] border-2 border-border bg-card px-7 pb-7 pt-4 text-center shadow-[0_8px_0_0_var(--border)]"
          >
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-med-soft to-transparent" aria-hidden />
            <Arzino mood="fireworks" size={210} className="relative mx-auto -mb-2" pop priority />
            <p className="eyebrow relative !text-med-ink dark:!text-med">{t('levelUp')}</p>
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.5, 1] }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="relative font-display text-[96px] font-black leading-none text-cedar drop-shadow-[0_5px_0_var(--cedar-d)]"
            >
              {level}
            </motion.p>
            <p className="relative mt-3 text-lg font-bold">{t('levelUpBody', { level })}</p>
            <Button variant="kid" size="lg" className="relative mt-6 w-full" onClick={onClose}>
              {t('awesome')}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Each badge has an Arzino pose; the badge emoji sits on it as a little pin. */
const BADGE_POSE: Record<string, ArzinoMood> = {
  first_mission: 'cheer',
  shadow_hunter: 'cool',
  architect: 'proud',
  pizza_master: 'starry-eyed',
  peer_hero: 'clipboard',
  kind_reviewer: 'warm',
  streak_7: 'on-fire',
  family_team: 'lebanese-pride',
  kitchen_chemist: 'surprise',
  time_traveler: 'reading',
};
export const badgePose = (key?: string): ArzinoMood => (key && BADGE_POSE[key]) || 'trophy';

export function BadgeCard({
  icon,
  name,
  earned = true,
  flip = false,
  size = 'md',
  badgeKey,
}: {
  icon: string;
  name: I18nText;
  earned?: boolean;
  flip?: boolean;
  size?: 'sm' | 'md';
  /** picks the Arzino pose for this badge */
  badgeKey?: string;
}) {
  const l = useL();
  const art = size === 'sm' ? 64 : 120;
  return (
    <motion.div
      initial={flip ? { rotateY: 180, scale: 0.6 } : false}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 90, damping: 12 }}
      style={{ transformStyle: 'preserve-3d' }}
      className={cn(
        'relative flex flex-col items-center gap-1 rounded-[20px] border-2 p-2.5 text-center',
        earned ? 'border-border bg-card shadow-[0_4px_0_0_var(--border)]' : 'border-dashed border-border bg-muted',
        flip && 'shine border-[#FFC21A] shadow-[0_4px_0_0_#E0A800]',
      )}
      data-testid="badge-card"
    >
      <span className={cn('relative', !earned && 'opacity-45 grayscale')}>
        <Arzino mood={badgePose(badgeKey)} size={art} animate={flip} title="" />
        <span
          className={cn(
            'absolute -bottom-1 end-0 flex items-center justify-center rounded-full border-2 border-card bg-[#FFF5D6] shadow-sm dark:bg-[#3b3212]',
            size === 'sm' ? 'size-7 text-sm' : 'size-10 text-xl',
          )}
          aria-hidden
        >
          {earned ? icon : '🔒'}
        </span>
      </span>
      <span className={cn('font-black leading-tight', size === 'sm' ? 'text-xs' : 'text-base', !earned && 'text-muted-foreground')}>{l(name)}</span>
    </motion.div>
  );
}

export function ValidatedStamp({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ scale: 3, opacity: 0, rotate: -25 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.2 }}
      className="inline-flex items-center gap-2 rounded-[16px] border-4 border-cedar bg-card px-5 py-2 font-display text-3xl font-black uppercase tracking-[0.08em] text-cedar-ink shadow-[0_5px_0_0_var(--cedar-d)] dark:text-cedar"
      data-testid="validated-stamp"
    >
      {label} ✓
    </motion.div>
  );
}
