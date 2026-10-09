'use client';

import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Top of a full-screen lesson screen: close (X) + chunky progress bar, like a Duolingo lesson. */
export function FocusTop({ href, progress, color = 'var(--cedar)', children, className }: { href: string; progress?: number; color?: string; children?: React.ReactNode; className?: string }) {
  const t = useTranslations('mission');
  return (
    <div className={cn('sticky top-0 z-30 -mx-4 flex items-center gap-4 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6', className)}>
      <Link href={href} className="-ms-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t('exit')}>
        <X className="size-7" strokeWidth={2.6} />
      </Link>
      {progress != null ? (
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-lock" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="bar-gloss h-full rounded-full"
            style={{ background: color }}
            initial={false}
            animate={{ width: `${Math.max(6, progress * 100)}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 16 }}
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {children}
    </div>
  );
}

/** Arzino-led header used on lesson screens: pose on the start side, eyebrow + big title on the other. */
export function LessonHeader({ art, eyebrow, eyebrowClass, title, sub, titleTestId }: { art: React.ReactNode; eyebrow?: React.ReactNode; eyebrowClass?: string; title: React.ReactNode; sub?: React.ReactNode; titleTestId?: string }) {
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <div className="shrink-0">{art}</div>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className={cn('eyebrow', eyebrowClass)}>{eyebrow}</p>}
        <h1 className="mt-0.5 font-display text-[26px] font-black leading-[1.1] sm:text-[30px]" data-testid={titleTestId}>
          {title}
        </h1>
        {sub && <p className="mt-1 font-bold text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
