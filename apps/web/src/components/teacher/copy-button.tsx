'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyButton({ value, className, testId }: { value: string; className?: string; testId?: string }) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard can be unavailable (insecure context); the value stays selectable on screen.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className={className} data-testid={testId}>
      {copied ? <Check className="text-success" /> : <Copy />}
      {copied ? t('copied') : t('copy')}
    </Button>
  );
}
