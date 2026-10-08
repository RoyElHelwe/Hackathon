import * as React from 'react';
import { cn } from '@/lib/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('h-12 w-full rounded-[14px] border-2 border-border bg-card px-4 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary', className)}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn('min-h-28 w-full rounded-[14px] border-2 border-border bg-card px-4 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-bold', className)} {...props} />;
}

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('h-12 w-full rounded-[14px] border-2 border-border bg-card px-3 text-base outline-none focus:border-primary', className)} {...props} />
));
Select.displayName = 'Select';
