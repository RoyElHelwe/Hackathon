import Link from 'next/link';
import { Arzino } from '@/components/arzino';
import { cn } from '@/lib/cn';

/** Little Lebanese flag: red · white with a cedar · red. */
export function FlagMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={cn('h-5 w-[30px] shrink-0 overflow-hidden rounded-[5px] shadow-[0_0_0_1px_var(--border)]', className)} aria-hidden>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="5" fill="#E4252D" />
      <rect y="15" width="30" height="5" fill="#E4252D" />
      <path d="M15 6.2l3.2 4.2h-1.5l2.3 2.6h-2.6l1.2 1.2h-5.2l1.2-1.2h-2.6l2.3-2.6h-1.5z" fill="#00A651" />
    </svg>
  );
}

export function Logo({ href = '/', className, small, mascot = false }: { href?: string; className?: string; small?: boolean; mascot?: boolean }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2.5', className)} aria-label="Tajriba home">
      {mascot ? <Arzino size={small ? 34 : 44} animate={false} mood="cheer" /> : <FlagMark />}
      <span className={cn('font-display font-black leading-none tracking-tight text-cedar', small ? 'text-2xl' : 'text-[28px]')}>
        tajriba
        <span className={cn('ms-1.5 text-base font-extrabold text-muted-foreground', small && 'hidden sm:inline')}>تجربة</span>
      </span>
    </Link>
  );
}
