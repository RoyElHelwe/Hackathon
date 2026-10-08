'use client';

import { motion } from 'motion/react';

/** Semi-circular score dial 0–100. */
export function ScoreDial({ score, size = 200, label }: { score: number; size?: number; label?: string }) {
  const r = 80;
  const c = Math.PI * r;
  const color = score >= 70 ? '#2DD4A7' : score >= 50 ? '#FFC83D' : '#FF7A59';
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.62 }} data-testid="score-dial">
      <svg viewBox="0 0 200 120" className="w-full">
        <path d="M20 110 A80 80 0 0 1 180 110" stroke="var(--muted)" strokeWidth="18" fill="none" strokeLinecap="round" />
        <motion.path
          d="M20 110 A80 80 0 0 1 180 110"
          stroke={color}
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="font-display text-5xl font-extrabold" data-testid="score-value">
          {score}
        </motion.span>
        {label && <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>}
      </div>
    </div>
  );
}
