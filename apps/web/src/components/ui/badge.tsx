import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap [&_svg]:size-3.5', {
  variants: {
    variant: {
      default: 'bg-violet-soft text-violet dark:text-white',
      mint: 'bg-mint-soft text-success',
      sunny: 'bg-sunny-soft text-warning',
      coral: 'bg-coral-soft text-danger',
      sky: 'bg-sky-soft text-sky dark:text-white',
      muted: 'bg-muted text-muted-foreground',
      outline: 'border border-border text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
