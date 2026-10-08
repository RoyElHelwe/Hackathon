'use client';

import { ErrorState } from '@/components/app/states';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <ErrorState onRetry={reset} />
    </main>
  );
}
