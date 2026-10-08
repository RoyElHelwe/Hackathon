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

/** Pill tabs to switch between linked children (only rendered when there is more than one). */
export function ChildSwitcher({ items, value, onChange }: { items: Child[]; value: string; onChange: (id: string) => void }) {
  const t = useTranslations('parent.dashboard');
  if (items.length < 2) return null;
  return (
    <div role="tablist" aria-label={t('switchChild')} className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="child-switcher">
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
              'flex h-12 shrink-0 items-center gap-2 rounded-full border-2 pe-4 ps-1.5 font-bold transition-colors',
              active ? 'border-primary bg-violet-soft text-primary dark:text-white' : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <Avatar name={c.name} src={c.avatarUrl} className="size-9 text-sm" />
            {firstName(c.name)}
          </button>
        );
      })}
    </div>
  );
}
