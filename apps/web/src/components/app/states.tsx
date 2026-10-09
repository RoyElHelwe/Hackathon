'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Arzino, type ArzinoMood } from '@/components/arzino';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

export function Thinking({ label, className }: { label?: string; className?: string }) {
  const t = useTranslations('common');
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-10 text-center', className)} role="status" aria-live="polite">
      <Arzino mood="thinking" size={130} />
      <p className="font-display text-lg text-muted-foreground">
        {label ?? t('thinking')}
        <span className="ms-1 inline-flex gap-0.5 align-middle" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-cedar" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      </p>
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  const t = useTranslations('common');
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-10 text-center', className)} role="alert">
      <Arzino mood="oops" size={140} />
      <p className="max-w-sm font-display text-lg leading-snug">{message ?? t('error')}</p>
      {onRetry && (
        <Button variant="kidGhost" onClick={onRetry} className="mt-1">
          <RefreshCw /> {t('retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, mood = 'bored-waiting', action, className }: { title: string; body?: string; mood?: ArzinoMood; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-10 text-center', className)}>
      <Arzino mood={mood} size={130} />
      <p className="font-display text-xl">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy>
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
