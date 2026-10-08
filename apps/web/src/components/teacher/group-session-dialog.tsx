'use client';

import { RefreshCw, Users, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { ErrorState, Thinking } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { errMessage } from './helpers';
import type { GroupSession } from './types';

/** "Plan a group session" — AI suggests small-group plans for stuck students. */
export function GroupSessionDialog({ classId, disabled }: { classId: string; disabled?: boolean }) {
  const t = useTranslations('teacher.group');
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GroupSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ groups: GroupSession[] }>(`/dashboards/teacher/${classId}/group-sessions`, { method: 'POST' });
      setGroups(res.groups);
    } catch (e) {
      setError(errMessage(e, t('error')));
    } finally {
      setLoading(false);
    }
  }, [classId, t]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !groups && !loading) void plan();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} data-testid="plan-group-session">
          <Wand2 /> {t('cta')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('subtitle')}</DialogDescription>
        <div className="mt-4">
          {loading ? (
            <Thinking label={t('thinking')} />
          ) : error ? (
            <ErrorState message={error} onRetry={plan} />
          ) : groups && !groups.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('empty')}</p>
          ) : (
            groups && (
              <div className="space-y-4" data-testid="group-session-plan">
                {groups.map((g, i) => (
                  <div key={`${g.topic}-${i}`} className="rounded-[18px] border border-border bg-muted/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-extrabold">{t('groupTitle', { topic: g.topic })}</p>
                      <Badge variant="default">
                        <Users /> {t('studentsN', { n: g.students.length })}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {g.students.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-card py-0.5 pe-3 ps-0.5 text-sm font-semibold">
                          <Avatar name={s.name} className="size-6 text-[10px]" /> {s.name}
                        </span>
                      ))}
                    </div>
                    <ol className="mt-4 space-y-2">
                      {g.plan.map((step, j) => (
                        <li key={j} className="flex gap-3 rounded-[14px] bg-card p-3 text-sm">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-soft text-xs font-extrabold text-primary dark:text-white">{j + 1}</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={plan}>
                    <RefreshCw /> {t('again')}
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
