'use client';

import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers without async clipboard permission.
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
  }
}

export function useCopy() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = useCallback(async (text: string) => {
    await writeClipboard(text);
    setCopied(true);
  }, []);
  return { copied, copy };
}

/** Button that copies `text` and flips to a ✓ for a moment. */
export function CopyButton({ text, label, copiedLabel, ...props }: { text: string; label: string; copiedLabel: string } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const { copied, copy } = useCopy();
  return (
    <Button variant={copied ? 'mint' : 'outline'} onClick={() => copy(text)} aria-live="polite" {...props}>
      {copied ? <Check /> : <Copy />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
