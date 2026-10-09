import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap [&_svg]:size-3.5', {
  variants: {
    variant: {
      default: 'bg-cedar-soft text-cedar-ink dark:text-white',
      mint: 'bg-cedar-soft text-cedar-ink dark:text-success',
      sunny: 'bg-flame-soft text-flame-d dark:text-warning',
      coral: 'bg-flag-soft text-flag-d dark:text-danger',
      sky: 'bg-med-soft text-med-ink dark:text-white',
      muted: 'bg-muted text-muted-foreground',
      outline: 'border border-border text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
