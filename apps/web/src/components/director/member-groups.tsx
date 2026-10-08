'use client';

import type { Role } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { membersPath } from './pending-members';
import type { Member } from './types';

const ORDER: Role[] = ['DIRECTOR', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT'];
const PREVIEW = 8;

/** Approved members grouped by role (tabs). */
export function MemberGroups({ schoolId }: { schoolId: string }) {
  const t = useTranslations('director.members');
  const tr = useTranslations('common.roles');
  const { data, isLoading, error, refetch } = useApi<Member[]>(membersPath(schoolId, 'APPROVED'));
  const groups = ORDER.map((role) => ({ role, items: (data ?? []).filter((m) => m.role === role).sort((a, b) => a.user.name.localeCompare(b.user.name)) })).filter(
    (g) => g.items.length || g.role === 'TEACHER',
  );

  return (
    <Card data-testid="approved-members">
      <CardHeader>
        <CardTitle>{t('approvedTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : error ? (
          <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} className="py-4" />
        ) : (
          <Tabs defaultValue="TEACHER">
            <TabsList className="mb-4 flex w-full flex-wrap justify-start">
              {groups.map((g) => (
                <TabsTrigger key={g.role} value={g.role} className="flex items-center gap-1.5" data-testid={`members-tab-${g.role}`}>
                  {tr(g.role)} <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{g.items.length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {groups.map((g) => (
              <TabsContent key={g.role} value={g.role}>
                <RoleList items={g.items} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function RoleList({ items }: { items: Member[] }) {
  const t = useTranslations('director.members');
  const tr = useTranslations('common.roles');
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="py-4 text-center text-sm text-muted-foreground">{t('emptyRole')}</p>;
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-[14px] p-2 hover:bg-muted/60" data-testid="member-row">
            <Avatar name={m.user.name} src={m.user.avatarUrl} className="size-9 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{m.user.name}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {m.user.email}
              </p>
            </div>
            <Badge variant="muted" className="hidden sm:inline-flex">
              {tr(m.role)}
            </Badge>
          </li>
        ))}
      </ul>
      {items.length > PREVIEW && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll((a) => !a)}>
          {all ? t('showLess') : t('showAll', { n: items.length })}
        </Button>
      )}
    </>
  );
}
