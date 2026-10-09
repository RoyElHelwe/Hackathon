'use client';

import { Delete } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/** Big friendly 6-digit keypad (parents linking a child). Always LTR digits. */
export function FamilyKeypad({ onComplete, disabled, error }: { onComplete: (code: string) => void; disabled?: boolean; error?: string | null }) {
  const [code, setCode] = useState('');
  const press = (d: string) => {
    if (disabled || code.length >= 6) return;
    const next = code + d;
    setCode(next);
    if (next.length === 6) onComplete(next);
  };
  const del = () => setCode((c) => c.slice(0, -1));
  return (
    <div className="mx-auto w-full max-w-xs" dir="ltr">
      <motion.div className="mb-5 flex justify-center gap-2" animate={error ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} key={error ?? 'ok'}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex h-16 w-12 items-center justify-center rounded-[14px] border-2 font-display text-3xl transition-colors',
              error
                ? 'border-flag bg-flag-soft text-flag-d shadow-[0_4px_0_var(--flag-d)] dark:text-danger'
                : code[i]
                  ? 'border-cedar bg-cedar-soft text-cedar-ink shadow-[0_4px_0_var(--cedar-d)] dark:text-white'
                  : i === code.length
                    ? 'border-med bg-card shadow-[0_4px_0_var(--med)]'
                    : 'border-border bg-card shadow-[0_4px_0_var(--border)]',
            )}
            data-testid={`code-digit-${i}`}
          >
            {code[i] ?? ''}
          </div>
        ))}
      </motion.div>
      <input
        aria-label="Family code"
        inputMode="numeric"
        className="sr-only"
        value={code}
        data-testid="family-code-input"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(v);
          if (v.length === 6) onComplete(v);
        }}
      />
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={disabled}>
            {d}
          </Key>
        ))}
        <Key onClick={() => setCode('')} disabled={disabled} className="bg-muted text-base text-muted-foreground">
          C
        </Key>
        <Key onClick={() => press('0')} disabled={disabled}>
          0
        </Key>
        <Key onClick={del} disabled={disabled} aria-label="Delete" className="bg-muted text-muted-foreground">
          <Delete className="size-7" />
        </Key>
      </div>
    </div>
  );
}

function Key({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn('kid-press flex h-16 items-center justify-center rounded-[18px] border-2 border-border bg-card font-display text-3xl [--press:var(--border)] hover:bg-muted disabled:opacity-50', className)}
      {...props}
    />
  );
}
