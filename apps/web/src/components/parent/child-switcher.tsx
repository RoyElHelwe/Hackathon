'use client';

import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { firstName } from './types';

interface Child {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** Chunky chips to switch between linked children (only rendered when there is more than one). */
export function ChildSwitcher({ items, value, onChange }: { items: Child[]; value: string; onChange: (id: string) => void }) {
  const t = useTranslations('parent.dashboard');
  if (items.length < 2) return null;
  return (
    <div role="tablist" aria-label={t('switchChild')} className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-2" data-testid="child-switcher">
      {items.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c.id)}
            data-testid={`child-tab-${c.id}`}
            className={cn(
              'flex h-14 shrink-0 items-center gap-2 rounded-[18px] border-2 pe-5 ps-2 font-black transition-[colors,transform] active:translate-y-[2px]',
              active
                ? 'border-flame bg-flame-soft text-flame-d shadow-[0_4px_0_var(--flame-d)] dark:text-warning'
                : 'border-border bg-card text-muted-foreground shadow-[0_4px_0_var(--border)] hover:bg-muted',
            )}
          >
            <Avatar name={c.name} src={c.avatarUrl} className="size-10 text-sm" />
            {firstName(c.name)}
          </button>
        );
      })}
    </div>
  );
}
