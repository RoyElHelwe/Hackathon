import Link from 'next/link';
import { Bousla } from '@/components/bousla';
import { cn } from '@/lib/cn';

export function Logo({ href = '/', className, small }: { href?: string; className?: string; small?: boolean }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2', className)} aria-label="Tajriba home">
      <Bousla size={small ? 30 : 40} animate={false} mood="happy" />
      <span className="font-display text-2xl font-extrabold leading-none tracking-tight text-primary">
        Tajriba <span className="text-lg text-muted-foreground">تجربة</span>
      </span>
    </Link>
  );
}
