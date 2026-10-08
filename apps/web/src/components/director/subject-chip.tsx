import { cn } from '@/lib/cn';

const BG: Record<string, string> = {
  violet: 'bg-violet-soft',
  sky: 'bg-sky-soft',
  mint: 'bg-mint-soft',
  green: 'bg-green-soft',
  coral: 'bg-coral-soft',
  sunny: 'bg-sunny-soft',
  pink: 'bg-coral-soft',
  slate: 'bg-muted',
};

export const subjectLabel = (name: { en?: string; ar?: string } | undefined, locale: string) => (locale === 'ar' ? name?.ar || name?.en : name?.en) ?? '';

export function SubjectChip({ name, color, locale, className }: { name: { en?: string; ar?: string }; color: string; locale: string; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-foreground', BG[color] ?? BG.slate, className)}>{subjectLabel(name, locale)}</span>;
}
