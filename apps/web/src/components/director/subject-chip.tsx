import { cn } from '@/lib/cn';

const BG: Record<string, string> = {
  violet: 'bg-cedar-soft',
  sky: 'bg-med-soft',
  mint: 'bg-mint-soft',
  green: 'bg-green-soft',
  coral: 'bg-flag-soft',
  sunny: 'bg-flame-soft',
  pink: 'bg-flag-soft',
  slate: 'bg-muted',
};

export const subjectLabel = (name: { en?: string; ar?: string } | undefined, locale: string) => (locale === 'ar' ? name?.ar || name?.en : name?.en) ?? '';

export function SubjectChip({ name, color, locale, className }: { name: { en?: string; ar?: string }; color: string; locale: string; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold text-foreground', BG[color] ?? BG.slate, className)}>{subjectLabel(name, locale)}</span>;
}
