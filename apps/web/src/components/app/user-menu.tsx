'use client';

import { Check, LogOut, Moon, Settings, Sun, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
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

  const switchRole = async (membershipId: string) => {
    const r = await api<{ home: string }>('/me/active-role', { body: { membershipId } });
    qc.clear();
    router.push(r.home);
    router.refresh();
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    qc.clear();
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full ring-offset-2 focus-visible:ring-2" aria-label={t('account')} data-testid="user-menu">
          <Avatar name={me.user.name} src={me.user.avatarUrl} className="size-11 border-2 border-white shadow" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-3 py-2">
          <p className="font-extrabold">{me.user.name}</p>
          <p className="text-xs text-muted-foreground">{me.active?.schoolName}</p>
        </div>
        {approved.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('switchRole')}</DropdownMenuLabel>
            {approved.map((m) => (
              <DropdownMenuItem key={m.id} onSelect={() => switchRole(m.id)} data-testid={`role-${m.role}`}>
                {me.active?.id === m.id ? <Check /> : <span className="size-4" />}
                {t(`roles.${m.role}`)} · {m.school.name}
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
