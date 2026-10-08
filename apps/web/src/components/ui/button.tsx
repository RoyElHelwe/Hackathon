import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-violet-600',
        secondary: 'bg-muted text-foreground hover:bg-violet-soft',
        outline: 'border-2 border-border bg-card hover:bg-muted',
        ghost: 'hover:bg-muted',
        destructive: 'bg-danger text-white hover:opacity-90',
        mint: 'bg-mint text-ink hover:brightness-95',
        // Chunky student button with a 4px "press" shadow
        kid: 'kid-press bg-primary text-primary-foreground font-display text-lg tracking-wide hover:brightness-105',
        kidMint: 'kid-press bg-mint text-ink font-display text-lg [--press:#1a9e7b] hover:brightness-105',
        kidSunny: 'kid-press bg-sunny text-ink font-display text-lg [--press:#d99f12] hover:brightness-105',
        kidCoral: 'kid-press bg-coral text-white font-display text-lg [--press:#d65a3b] hover:brightness-105',
        kidGhost: 'kid-press bg-card text-foreground border-2 border-border font-display text-lg [--press:var(--border)]',
      },
      size: {
        default: 'h-12 rounded-[16px] px-5 text-base',
        sm: 'h-10 rounded-[12px] px-3 text-sm',
        lg: 'h-14 rounded-[16px] px-7 text-lg',
        pill: 'h-14 rounded-full px-8 text-lg',
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
