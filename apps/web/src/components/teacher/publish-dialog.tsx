'use client';

import { CalendarDays, Rocket, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { fireConfetti } from '@/components/kid/celebrations';
import { Arzino } from '@/components/arzino';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import type { Mission } from '@/lib/types';
import { errMessage } from './helpers';
import type { ApproveResult, SafetyResult } from './types';

interface Props {
  mission: Mission;
  title: string;
  className: string;
  classroomLinked: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPublished: (r: ApproveResult) => void;
  onSafety: (s: SafetyResult) => void;
  /** course template: publishing goes to every section (and every section's Classroom) */
  courseMode?: boolean;
}

/** "Approve & publish": optional Google Classroom post + due date. */
export function PublishDialog({ mission, title, className, classroomLinked, open, onOpenChange, onPublished, onSafety, courseMode = false }: Props) {
  const t = useTranslations('teacher.publish');
  const [post, setPost] = useState(classroomLinked);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    setIssues([]);
    try {
      const dueAt = due ? new Date(`${due}T23:59:00`).toISOString() : undefined;
      const res = await api<ApproveResult>(`/missions/${mission.id}/approve`, { body: { postToClassroom: post && classroomLinked, dueAt } });
      fireConfetti();
      onPublished(res);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.data.safety) {
        const s = e.data.safety as SafetyResult;
        setIssues(s.issues);
        onSafety(s);
      }
      setError(errMessage(e, t('error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex items-center gap-4">
          <Arzino mood="teaching" size={84} />
          <div className="min-w-0">
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription className="mt-1">{t('body', { title, className })}</DialogDescription>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-[16px] border-2 border-med/30 bg-med-soft/60 p-4">
            <div>
              <Label htmlFor="post-to-classroom" className="mb-0.5">
                {t('postLabel')}
              </Label>
              <p className="text-sm text-muted-foreground">{classroomLinked ? t(courseMode ? 'postHintCourse' : 'postHint') : t(courseMode ? 'notLinkedCourse' : 'notLinked')}</p>
            </div>
            <Switch id="post-to-classroom" checked={post && classroomLinked} onCheckedChange={setPost} disabled={!classroomLinked} data-testid="post-to-classroom" />
          </div>
          <div>
            <Label htmlFor="due-date" className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-muted-foreground" /> {t('dueLabel')}
            </Label>
            <Input id="due-date" type="date" value={due} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDue(e.target.value)} data-testid="due-date" />
            <p className="mt-1 text-xs text-muted-foreground">{t('dueHint')}</p>
          </div>
          {error && (
            <div className="rounded-[14px] border-2 border-flag/30 bg-flag-soft p-3 text-sm" role="alert">
              <p className="flex items-center gap-2 font-bold text-flag-d dark:text-danger">
                <ShieldAlert className="size-4" /> {error}
              </p>
              {!!issues.length && (
                <ul className="ms-6 mt-1 list-disc">
                  {issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t('safetyNote')}</p>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button variant="kid" onClick={confirm} loading={busy} data-testid="confirm-publish">
            <Rocket /> {t('confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
