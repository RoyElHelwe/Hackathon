'use client';

import { motion } from 'motion/react';

/** Mastery colors: flag red < 50, Mediterranean blue 50–69, cedar ≥ 70. */
export const masteryHex = (score: number) => (score >= 70 ? '#00A651' : score >= 50 ? '#1C8BE0' : '#E4252D');

/** Semi-circular score dial 0–100. */
export function ScoreDial({ score, size = 220, label }: { score: number; size?: number; label?: string }) {
  const r = 80;
  const c = Math.PI * r;
  const color = masteryHex(score);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.64 }} data-testid="score-dial">
      <svg viewBox="0 0 200 124" className="w-full">
        <path d="M20 110 A80 80 0 0 1 180 110" stroke="var(--lock)" strokeWidth="20" fill="none" strokeLinecap="round" />
        <motion.path
          d="M20 110 A80 80 0 0 1 180 110"
          stroke={color}
          strokeWidth="20"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 12 }}
          className="font-display text-6xl font-black leading-none"
          style={{ color }}
          data-testid="score-value"
        >
          {score}
        </motion.span>
        {label && <p className="eyebrow mt-1">{label}</p>}
      </div>
    </div>
  );
}
