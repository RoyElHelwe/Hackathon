'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Bousla, type BouslaMood } from '@/components/bousla';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

export function Thinking({ label, className }: { label?: string; className?: string }) {
  const t = useTranslations('common');
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-10 text-center', className)} role="status" aria-live="polite">
      <Bousla mood="thinking" size={96} />
      <p className="font-display text-lg font-bold text-muted-foreground">{label ?? t('thinking')}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  const t = useTranslations('common');
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-10 text-center', className)} role="alert">
      <Bousla mood="curious" size={88} />
      <p className="max-w-sm font-semibold">{message ?? t('error')}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> {t('retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, mood = 'sleepy', action, className }: { title: string; body?: string; mood?: BouslaMood; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-10 text-center', className)}>
      <Bousla mood={mood} size={88} />
      <p className="font-display text-lg font-bold">{title}</p>
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
