'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EYEBROW } from './tone';

interface Point {
  day: string;
  validated: number;
}

/** Missions validated per day (single series → no legend; crosshair + tooltip on hover). */
export function TrendChart({ data }: { data: Point[] }) {
  const t = useTranslations('director.overview');
  const format = useFormatter();
  const total = data.reduce((s, p) => s + p.validated, 0);
  const label = (day: string) => format.dateTime(new Date(`${day}T12:00:00Z`), { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <Card className="flex h-full flex-col" data-testid="trend-chart">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardDescription className={EYEBROW}>{t('trendSubtitle')}</CardDescription>
          <CardTitle className="mt-1 text-xl">{t('trendTitle')}</CardTitle>
        </div>
        <span className="shrink-0 rounded-full bg-cedar-soft px-3 py-1 text-sm font-black text-cedar-ink dark:text-success">{t('trendTotal', { n: total })}</span>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-full min-h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cedar)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--cedar)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey="day" tickFormatter={label} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} width={44} />
              <Tooltip
                cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0] ? (payload[0].payload as Point) : null;
                  if (!p) return null;
                  return (
                    <div className="rounded-[14px] border-2 border-border bg-card px-3 py-2 text-sm shadow-[0_4px_0_var(--border)]">
                      <p className="font-black">{label(p.day)}</p>
                      <p className="font-bold text-cedar-ink dark:text-success">{t('trendTooltip', { n: p.validated })}</p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="validated" stroke="var(--cedar)" strokeWidth={3} fill="url(#trendFill)" activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--card)', fill: 'var(--cedar)' }} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
