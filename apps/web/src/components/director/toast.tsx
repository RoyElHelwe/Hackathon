'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface ToastMsg {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

/** Tiny local toast: `const { toast, node } = useToast()`, render `node` once. */
export function useToast() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(id);
  }, [msg]);
  const toast = useCallback((text: string, tone: ToastMsg['tone'] = 'success') => setMsg({ id: Date.now(), text, tone }), []);
  const node = (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {msg && (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn('pointer-events-auto flex items-center gap-2 rounded-[16px] border-2 px-5 py-3 font-extrabold shadow-[0_4px_0_rgba(0,0,0,0.18)]', msg.tone === 'success' ? 'border-ink bg-ink text-white dark:border-border dark:bg-card' : 'border-flag-d bg-flag text-white')}
            role="status"
            data-testid="toast"
          >
            {msg.tone === 'success' ? <CheckCircle2 className="size-5 text-cedar" /> : <XCircle className="size-5" />}
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  return { toast, node };
}
