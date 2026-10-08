'use client';

import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { FLAG_VARIANT, KNOWN_FLAGS } from './helpers';

export function FlagBadges({ flags }: { flags: string[] }) {
  const t = useTranslations('teacher.flags');
  const unique = [...new Set(flags)];
  if (!unique.length) return null;
  return (
    <>
      {unique.map((f) => (
        <Badge key={f} variant={FLAG_VARIANT[f] ?? 'muted'} data-testid={`flag-${f}`}>
          <Flag /> {KNOWN_FLAGS.includes(f) ? t(`${f}.label`) : f.replace(/_/g, ' ')}
        </Badge>
      ))}
    </>
  );
}
