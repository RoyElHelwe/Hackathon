'use client';

import { Languages, Plus, ShieldCheck, Trash2, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useInvalidate } from '@/lib/hooks';
import { dashboardPath } from './use-school';
import type { School, SchoolSettings } from './types';

type Policy = NonNullable<SchoolSettings['leaderboardPolicy']>;
type Locale = NonNullable<SchoolSettings['defaultLocale']>;
const POLICIES: Policy[] = ['TEACHER_CHOICE', 'ALWAYS_OFF'];
const LOCALES: Locale[] = ['en', 'ar', 'fr'];

interface FormState {
  leaderboardPolicy: Policy;
  safetyRules: string[];
  defaultLocale: Locale;
}

const fromSchool = (s: School): FormState => ({
  leaderboardPolicy: s.settings.leaderboardPolicy ?? 'TEACHER_CHOICE',
  safetyRules: s.settings.safetyRules ?? [],
  defaultLocale: s.settings.defaultLocale ?? 'en',
});

export function SettingsForm({ school, onToast }: { school: School; onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const t = useTranslations('director.settings');
  const tc = useTranslations('common');
  const invalidate = useInvalidate();
  const [saved, setSaved] = useState<FormState>(() => fromSchool(school));
  const [form, setForm] = useState<FormState>(saved);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = (f: FormState) => ({ ...f, safetyRules: f.safetyRules.map((r) => r.trim()).filter(Boolean) });
  const dirty = useMemo(() => JSON.stringify(clean(form)) !== JSON.stringify(clean(saved)) || !!draft.trim(), [form, saved, draft]);

  const addRule = () => {
    const v = draft.trim();
    if (!v) return;
    setForm((f) => ({ ...f, safetyRules: [...f.safetyRules, v] }));
    setDraft('');
  };

  const save = async () => {
    setBusy(true);
    const body = clean({ ...form, safetyRules: draft.trim() ? [...form.safetyRules, draft.trim()] : form.safetyRules });
    try {
      await api(`/schools/${school.id}/settings`, { method: 'PATCH', body });
      setSaved(body);
      setForm(body);
      setDraft('');
      onToast(t('saved'));
      void invalidate(`/schools/${school.id}`, dashboardPath(school.id));
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : t('unsaved'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-warning" /> {t('leaderboard')}
          </CardTitle>
          <CardDescription>{t('leaderboardBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('leaderboard')} className="grid gap-3 sm:grid-cols-2">
            {POLICIES.map((p) => {
              const on = form.leaderboardPolicy === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setForm((f) => ({ ...f, leaderboardPolicy: p }))}
                  className={cn('flex items-start gap-3 rounded-[16px] border-2 p-4 text-start transition-colors', on ? 'border-primary bg-violet-soft' : 'border-border hover:bg-muted')}
                  data-testid={`policy-${p}`}
                >
                  <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary' : 'border-border')}>
                    {on && <span className="size-2.5 rounded-full bg-primary" />}
                  </span>
                  <span>
                    <span className="block font-extrabold">{t(p)}</span>
                    <span className="block text-sm text-muted-foreground">{t(`${p}_body`)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-success" /> {t('safety')}
          </CardTitle>
          <CardDescription>{t('safetyBody')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {form.safetyRules.length === 0 && <p className="text-sm text-muted-foreground">{t('noRules')}</p>}
          {form.safetyRules.map((r, i) => (
            <div key={i} className="flex items-center gap-2" data-testid="safety-rule">
              <Input
                value={r}
                onChange={(e) => setForm((f) => ({ ...f, safetyRules: f.safetyRules.map((x, j) => (j === i ? e.target.value : x)) }))}
                aria-label={`${t('safety')} ${i + 1}`}
              />
              <Button variant="ghost" size="icon" aria-label={t('removeRule')} onClick={() => setForm((f) => ({ ...f, safetyRules: f.safetyRules.filter((_, j) => j !== i) }))}>
                <Trash2 className="text-danger" />
              </Button>
            </div>
          ))}
          <form
            className="flex items-center gap-2 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              addRule();
            }}
          >
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('rulePlaceholder')} data-testid="new-safety-rule" />
            <Button type="submit" variant="outline" disabled={!draft.trim()} data-testid="add-safety-rule">
              <Plus /> <span className="hidden sm:inline">{t('addRule')}</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="size-5 text-sky" /> {t('language')}
          </CardTitle>
          <CardDescription>{t('languageBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('language')} className="inline-flex rounded-[16px] bg-muted p-1">
            {LOCALES.map((loc) => (
              <button
                key={loc}
                type="button"
                role="radio"
                aria-checked={form.defaultLocale === loc}
                onClick={() => setForm((f) => ({ ...f, defaultLocale: loc }))}
                className={cn('h-10 rounded-[12px] px-5 font-bold transition-colors', form.defaultLocale === loc ? 'bg-card shadow-sm' : 'text-muted-foreground')}
                data-testid={`locale-${loc}`}
              >
                {t(loc)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-[20px] border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        {dirty && <p className="me-auto ps-2 text-sm font-semibold text-warning">{t('unsaved')}</p>}
        <Button
          variant="ghost"
          disabled={!dirty || busy}
          onClick={() => {
            setForm(saved);
            setDraft('');
          }}
        >
          {tc('cancel')}
        </Button>
        <Button onClick={save} loading={busy} disabled={!dirty} data-testid="save-settings">
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
