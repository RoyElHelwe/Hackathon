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
              'flex h-14 w-11 items-center justify-center rounded-[14px] border-2 font-display text-3xl font-extrabold',
              error ? 'border-danger bg-coral-soft' : code[i] ? 'border-primary bg-violet-soft text-primary dark:text-white' : 'border-border bg-card',
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
        <Key onClick={() => setCode('')} disabled={disabled} className="text-base">
          C
        </Key>
        <Key onClick={() => press('0')} disabled={disabled}>
          0
        </Key>
        <Key onClick={del} disabled={disabled} aria-label="Delete">
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
      className={cn('kid-press flex h-16 items-center justify-center rounded-[18px] border-2 border-border bg-card font-display text-3xl font-extrabold [--press:var(--border)] disabled:opacity-50', className)}
      {...props}
    />
  );
}
