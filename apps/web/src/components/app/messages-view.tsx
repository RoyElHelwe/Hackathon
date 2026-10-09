'use client';

import { Send } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate } from '@/lib/hooks';
import { EmptyState, ErrorState, PageSkeleton } from './states';

interface Contact {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'TEACHER' | 'PARENT';
  about: { studentId: string; studentName: string }[];
  unread: number;
}
interface Msg {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

/** Parent ↔ teacher chat (contacts list + thread). */
export function MessagesView({ initialWith }: { initialWith?: string }) {
  const t = useTranslations('common');
  const format = useFormatter();
  // ticks once a minute; messages newer than the last tick are compared with the real clock (never "in 52 seconds")
  const now = useNow({ updateInterval: 60_000 });
  const { data: contacts, isLoading, error, refetch } = useApi<Contact[]>('/messages/contacts');
  const [withId, setWithId] = useState<string | undefined>(initialWith);
  const active = contacts?.find((c) => c.id === withId) ?? contacts?.[0];
  const { data: thread } = useApi<Msg[]>(active ? `/messages?with=${active.id}` : null, { refetchInterval: 8000 });
  const invalidate = useInvalidate();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // braces: newer Chrome returns a Promise from scrollIntoView, which React would take as the effect's cleanup
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.length]);

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  if (!contacts?.length) return <EmptyState title={t('noContacts')} mood="sleepy" />;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !body.trim()) return;
    setSending(true);
    try {
      await api('/messages', { body: { toId: active.id, body: body.trim(), studentId: active.about[0]?.studentId } });
      setBody('');
      await invalidate(`/messages?with=${active.id}`, '/messages/contacts');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card className="p-2">
        <ul>
          {contacts.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setWithId(c.id)}
                className={cn('flex w-full items-center gap-3 rounded-[14px] p-3 text-start', active?.id === c.id ? 'bg-violet-soft' : 'hover:bg-muted')}
                data-testid={`contact-${c.id}`}
              >
                <Avatar name={c.name} src={c.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.about.map((a) => a.studentName.split(' ')[0]).join(', ')}</p>
                </div>
                {c.unread > 0 && <span className="rounded-full bg-coral px-2 text-xs font-extrabold text-white">{c.unread}</span>}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex h-[60vh] flex-col">
        <div className="flex items-center gap-3 border-b border-border p-4">
          {active && <Avatar name={active.name} src={active.avatarUrl} />}
          <p className="font-extrabold">{active?.name}</p>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4" data-testid="message-thread">
          {thread?.map((m) => (
            <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-[18px] px-4 py-2', m.mine ? 'rounded-ee-sm bg-primary text-white' : 'rounded-es-sm bg-muted')}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn('mt-1 text-[11px]', m.mine ? 'text-white/70' : 'text-muted-foreground')}>{format.relativeTime(new Date(m.createdAt), new Date(Math.max(now.getTime(), Date.now())))}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('typeMessage')} aria-label={t('typeMessage')} data-testid="message-input" />
          <Button type="submit" size="icon" loading={sending} aria-label={t('send')}>
            <Send className="rtl-flip" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
