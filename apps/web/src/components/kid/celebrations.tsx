'use client';

import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Bousla } from '@/components/bousla';
import { Button } from '@/components/ui/button';
import { useSound } from '@/components/app/theme';
import { useL } from '@/lib/hooks';
import type { I18nText } from '@tajriba/shared';

export function fireConfetti(strong = false) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#6C4CF1', '#2DD4A7', '#FFC83D', '#FF7A59', '#4CB8FF'];
  confetti({ particleCount: strong ? 160 : 90, spread: strong ? 100 : 70, origin: { y: 0.6 }, colors, scalar: 1.1 });
  if (strong) {
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 }, colors }), 250);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 }, colors }), 400);
  }
}

/** "+50 XP" floating up. */
export function FloatingXp({ amount, show }: { amount: number; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: -70, scale: 1.2 }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-x-0 top-0 z-20 text-center font-display text-4xl font-extrabold text-mint drop-shadow"
          data-testid="floating-xp"
        >
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
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal data-testid="level-up">
          <motion.div
            initial={{ scale: 0.6, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 12 }}
            className="w-full max-w-sm rounded-[32px] bg-card p-8 text-center shadow-2xl"
          >
            <Bousla mood="cheering" size={140} className="mx-auto" />
            <p className="mt-2 font-display text-xl font-bold text-muted-foreground">{t('levelUp')}</p>
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.4, 1] }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="font-display text-7xl font-extrabold text-primary"
            >
              {level}
            </motion.p>
            <p className="mt-1 font-semibold">{t('levelUpBody', { level })}</p>
            <Button variant="kid" size="pill" className="mt-6 w-full" onClick={onClose}>
              {t('awesome')}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BadgeCard({ icon, name, earned = true, flip = false, size = 'md' }: { icon: string; name: I18nText; earned?: boolean; flip?: boolean; size?: 'sm' | 'md' }) {
  const l = useL();
  return (
    <motion.div
      initial={flip ? { rotateY: 180, scale: 0.6 } : false}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 90, damping: 12 }}
      style={{ transformStyle: 'preserve-3d' }}
      className={`flex flex-col items-center gap-1 rounded-[20px] border-2 p-3 text-center ${earned ? 'border-sunny bg-sunny-soft' : 'border-dashed border-border bg-muted opacity-60 grayscale'} ${flip ? 'shine' : ''}`}
      data-testid="badge-card"
    >
      <span className={size === 'sm' ? 'text-3xl' : 'text-4xl'} aria-hidden>
        {earned ? icon : '🔒'}
      </span>
      <span className="text-xs font-extrabold leading-tight">{l(name)}</span>
    </motion.div>
  );
}

export function ValidatedStamp({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ scale: 3, opacity: 0, rotate: -25 }}
      animate={{ scale: 1, opacity: 1, rotate: -12 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.2 }}
      className="inline-flex items-center gap-2 rounded-[14px] border-4 border-mint px-5 py-2 font-display text-3xl font-extrabold uppercase tracking-wider text-success"
      data-testid="validated-stamp"
    >
      {label} ✓
    </motion.div>
  );
}
