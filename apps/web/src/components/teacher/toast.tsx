'use client';

import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  for (const l of listeners) l();
}

/** Shows a small toast at the bottom of the screen (teacher area). */
export function toast(message: string, tone: Tone = 'success') {
  const id = nextId++;
  items = [...items, { id, message, tone }].slice(-3);
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 4500);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONES: Record<Tone, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-med',
};

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {list.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-[16px] border-2 border-border bg-card px-4 py-3 text-sm font-extrabold shadow-[0_4px_0_0_var(--border),0_12px_32px_-12px_rgba(22,38,42,0.25)]"
              role="status"
              data-testid="toast"
            >
              <Icon className={cn('size-5 shrink-0', TONES[t.tone])} />
              <span>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
