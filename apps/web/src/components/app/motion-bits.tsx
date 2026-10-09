'use client';

import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

/** Fades + lifts its children in once they scroll into view. */
export function Reveal({ children, className, delay = 0, y = 24 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A little chip that pops in, then bobs gently. */
export function FloatChip({ children, className, delay = 0, amplitude = 8 }: { children: React.ReactNode; className?: string; delay?: number; amplitude?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn('absolute', className)}
      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.4 + delay }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -amplitude, 0] }}
        transition={{ duration: 3.4 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Wiggles on hover / tap (stickers). */
export function Wiggle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} whileHover={{ rotate: [0, -6, 6, -3, 0], y: -6, transition: { duration: 0.5 } }} whileTap={{ scale: 0.92 }}>
      {children}
    </motion.div>
  );
}

/** Endless horizontal strip; children are rendered twice so the loop is seamless. */
export function Marquee({ children, rtl = false, seconds = 40, className }: { children: React.ReactNode; rtl?: boolean; seconds?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn('relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]', className)}>
      <motion.div
        className="flex w-max"
        animate={reduce ? undefined : { x: rtl ? ['0%', '50%'] : ['0%', '-50%'] }}
        transition={{ duration: seconds, repeat: Infinity, ease: 'linear' }}
      >
        <div className="flex shrink-0 gap-3 pe-3">{children}</div>
        <div className="flex shrink-0 gap-3 pe-3" aria-hidden>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
