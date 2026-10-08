'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-[14px] bg-muted', className)} {...props} />;
}

export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('h-3 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-700', barClassName)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn('peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-muted transition-colors data-[state=checked]:bg-primary', className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-6 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5" />
    </SwitchPrimitive.Root>
  );
}

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('relative flex h-10 w-full touch-none select-none items-center', className)} {...props}>
      <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-coral via-sunny to-mint" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-8 rounded-full border-4 border-white bg-primary shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-ring/40" aria-label="score" />
    </SliderPrimitive.Root>
  );
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 5;
  const colors = ['bg-violet text-white', 'bg-mint text-ink', 'bg-sunny text-ink', 'bg-coral text-white', 'bg-sky text-white'];
  return (
    <AvatarPrimitive.Root className={cn('inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold', colors[hue], className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback delayMs={src ? 400 : 0}>{initials}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('inline-flex rounded-[16px] bg-muted p-1', className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn('rounded-[12px] px-4 py-2 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm', className)}
      {...props}
    />
  );
}
export const TabsContent = TabsPrimitive.Content;
