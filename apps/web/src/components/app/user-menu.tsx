'use client';

import { Check, LogOut, Moon, Settings, Sun, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Arzino } from '@/components/arzino';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { api } from '@/lib/api';
import { resetSocket } from '@/lib/campus/socket';
import { useMe } from '@/lib/hooks';
import { roleStyle } from './role-style';
import { useSettings } from './theme';
import { useQueryClient } from '@tanstack/react-query';

export function UserMenu() {
  const t = useTranslations('common');
  const { data: me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const { theme, setTheme, sounds, setSounds } = useSettings();
  if (!me) return null;
  const approved = me.memberships.filter((m) => m.status === 'APPROVED');
  const active = roleStyle(me.active?.role ?? 'STUDENT');

  const switchRole = async (membershipId: string) => {
    const r = await api<{ home: string }>('/me/active-role', { body: { membershipId } });
    resetSocket();
    qc.clear();
    router.push(r.home);
    router.refresh();
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    resetSocket();
    qc.clear();
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full transition-transform active:scale-95" aria-label={t('account')} data-testid="user-menu">
          <Avatar name={me.user.name} src={me.user.avatarUrl} className="size-11 border-[3px] border-card shadow-[0_0_0_2px_var(--border),0_3px_0_2px_var(--border)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64 rounded-[20px] border-2 p-2 shadow-[0_5px_0_var(--border)]">
        <div className={cn('mb-1 flex items-center gap-3 rounded-[14px] p-3', active.soft)}>
          <Avatar name={me.user.name} src={me.user.avatarUrl} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{me.user.name}</p>
            <p className="truncate text-xs font-bold text-muted-foreground">{me.active?.schoolName}</p>
          </div>
          <Arzino mood={active.mood} size={44} animate={false} />
        </div>
        {approved.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('switchRole')}</DropdownMenuLabel>
            {approved.map((m) => (
              <DropdownMenuItem key={m.id} onSelect={() => switchRole(m.id)} data-testid={`role-${m.role}`} className={cn(me.active?.id === m.id && 'bg-muted')}>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider', roleStyle(m.role).solid)}>{t(`roles.${m.role}`)}</span>
                <span className="min-w-0 flex-1 truncate">{m.school.name}</span>
                {me.active?.id === m.id && <Check className="text-cedar" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun /> : <Moon />} {theme === 'dark' ? t('lightMode') : t('darkMode')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setSounds(!sounds)}>
          {sounds ? <VolumeX /> : <Volume2 />} {sounds ? t('soundsOff') : t('soundsOn')}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> {t('settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} data-testid="logout">
          <LogOut className="rtl-flip" /> {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
