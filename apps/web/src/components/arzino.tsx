'use client';

import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';
import { cn } from '@/lib/cn';

/** Every Arzino sticker in /public/arzino (see docs/arzino-design/DESIGN.md §6 for which pose fits which moment). */
export const ARZINO_POSES = [
  'welcome', 'cheer', 'correct', 'starry-eyed', 'cool', 'teaching', 'clipboard', 'thinking', 'reading', 'writing',
  'oops', 'exhausted', 'practice-nudge', 'laser-focus', 'flop-cry', 'celebrate', 'party', 'streak-hug', 'streak-buddy',
  'streak-danger', 'streak-lost', 'frozen', 'on-fire', 'sleepy', 'bored-waiting', 'shocked', 'cold', 'warm',
  'lebanese-pride', 'trophy', 'embarrassed', 'determined', 'sad', 'mad', 'melted', 'fainted', 'sick',
  'proud', 'fireworks', 'missed-you', 'surprise', 'try-again', 'please-practice', 'heartbroken', 'streak-small',
] as const;
export type ArzinoPose = (typeof ARZINO_POSES)[number];

/** Short mood names kept for convenience; they map onto a pose. */
const ALIASES = {
  happy: 'welcome',
  cheering: 'celebrate',
  curious: 'starry-eyed',
} as const satisfies Record<string, ArzinoPose>;

export type ArzinoMood = ArzinoPose | keyof typeof ALIASES;

const BOUNCY = new Set<ArzinoPose>(['cheer', 'celebrate', 'party', 'fireworks', 'on-fire', 'correct', 'trophy', 'proud', 'streak-hug']);
const WOBBLY = new Set<ArzinoPose>(['oops', 'shocked', 'surprise', 'streak-danger', 'mad', 'try-again']);
const DROOPY = new Set<ArzinoPose>(['sleepy', 'sad', 'flop-cry', 'streak-lost', 'heartbroken', 'melted', 'exhausted', 'fainted', 'bored-waiting', 'frozen', 'cold', 'sick']);

export function poseOf(mood: ArzinoMood): ArzinoPose {
  return (ALIASES as Record<string, ArzinoPose>)[mood] ?? (mood as ArzinoPose);
}

export function arzinoSrc(mood: ArzinoMood) {
  return `/arzino/${poseOf(mood)}.webp`;
}

interface Props {
  mood?: ArzinoMood;
  /** Box size in px; the sticker is fitted inside a size × size square. */
  size?: number;
  className?: string;
  animate?: boolean;
  title?: string;
  /** Pop in on mount. */
  pop?: boolean;
  priority?: boolean;
}

/** Arzino (أرزينو), Tajriba's little cedar coach. One sticker per moment, gently alive. */
export function Arzino({ mood = 'happy', size = 120, className, animate = true, title = 'Arzino', pop = false, priority = false }: Props) {
  const reduce = useReducedMotion();
  const live = animate && !reduce;
  const pose = poseOf(mood);

  let loop: TargetAndTransition | undefined;
  let loopT: Transition | undefined;
  if (live) {
    if (BOUNCY.has(pose)) {
      loop = { y: [0, -10, 0], rotate: [0, -2, 2, 0] };
      loopT = { duration: 0.9, repeat: Infinity, ease: 'easeInOut' };
    } else if (WOBBLY.has(pose)) {
      loop = { rotate: [0, -4, 4, -2, 0] };
      loopT = { duration: 1.6, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' };
    } else if (DROOPY.has(pose)) {
      loop = { y: [0, 2, 0], scaleY: [1, 0.98, 1] };
      loopT = { duration: 3.2, repeat: Infinity, ease: 'easeInOut' };
    } else if (pose === 'thinking') {
      loop = { rotate: [0, 3, 0, -3, 0], y: [0, -3, 0] };
      loopT = { duration: 2.4, repeat: Infinity, ease: 'easeInOut' };
    } else {
      loop = { y: [0, -4, 0] };
      loopT = { duration: 2.8, repeat: Infinity, ease: 'easeInOut' };
    }
  }

  return (
    <motion.span
      className={cn('relative inline-flex shrink-0 select-none items-end justify-center', className)}
      style={{ width: size, height: size }}
      initial={pop && live ? { scale: 0.4, opacity: 0, y: 20 } : false}
      animate={pop && live ? { scale: 1, opacity: 1, y: 0 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
    >
      <motion.img
        key={pose}
        src={arzinoSrc(pose)}
        alt={title}
        width={size}
        height={size}
        draggable={false}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="pointer-events-none size-full object-contain drop-shadow-[0_6px_0_rgba(22,38,42,0.06)]"
        style={{ transformOrigin: '50% 100%' }}
        animate={loop}
        transition={loopT}
      />
    </motion.span>
  );
}

/** Speech bubble next to Arzino. */
export function ArzinoSays({ mood = 'happy', children, size = 72, className }: { mood?: ArzinoMood; children: React.ReactNode; size?: number; className?: string }) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <Arzino mood={mood} size={size} />
      <div className="relative mb-4 rounded-[20px] rounded-es-md border-2 border-border bg-card px-4 py-3 text-base font-bold leading-snug shadow-[0_4px_0_var(--border)]">
        {children}
      </div>
    </div>
  );
}
