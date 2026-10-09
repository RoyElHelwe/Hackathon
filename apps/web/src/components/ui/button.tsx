import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-extrabold transition-[colors,filter] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'kid-press bg-primary text-primary-foreground hover:brightness-105 [--press:var(--cedar-d)]',
        secondary: 'bg-muted text-foreground hover:bg-cedar-soft',
        outline: 'border-2 border-border bg-card shadow-[0_3px_0_var(--border)] hover:bg-muted active:translate-y-[3px] active:shadow-none',
        ghost: 'hover:bg-muted',
        destructive: 'kid-press bg-flag text-white hover:brightness-105 [--press:var(--flag-d)]',
        mint: 'kid-press bg-med text-white hover:brightness-105 [--press:var(--med-d)]',
        // Chunky student buttons: uppercase, tracked, 5px darker bottom edge that sinks on tap
        kid: 'kid-press bg-cedar text-white font-display uppercase tracking-[0.08em] hover:brightness-105 [--press:var(--cedar-d)]',
        kidMint: 'kid-press bg-med text-white font-display uppercase tracking-[0.08em] hover:brightness-105 [--press:var(--med-d)]',
        kidSunny: 'kid-press bg-flame text-white font-display uppercase tracking-[0.08em] hover:brightness-105 [--press:var(--flame-d)]',
        kidCoral: 'kid-press bg-flag text-white font-display uppercase tracking-[0.08em] hover:brightness-105 [--press:var(--flag-d)]',
        kidGhost: 'kid-press bg-card text-med-ink dark:text-white border-2 border-border font-display uppercase tracking-[0.08em] [--press:var(--border)] hover:bg-muted',
      },
      size: {
        default: 'h-12 rounded-[16px] px-5 text-[15px]',
        sm: 'h-10 rounded-[12px] px-3 text-sm',
        lg: 'h-14 rounded-[16px] px-7 text-base',
        pill: 'h-14 rounded-[16px] px-8 text-base',
        icon: 'h-12 w-12 rounded-[16px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
});
Button.displayName = 'Button';

export { buttonVariants };
