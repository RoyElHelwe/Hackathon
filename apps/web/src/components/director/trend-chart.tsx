'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>{t('trendTitle')}</CardTitle>
          <CardDescription>{t('trendSubtitle')}</CardDescription>
        </div>
        <span className="rounded-full bg-violet-soft px-3 py-1 text-sm font-extrabold text-primary dark:text-white">{t('trendTotal', { n: total })}</span>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-full min-h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey="day" tickFormatter={label} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} width={44} />
              <Tooltip
                cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0] ? (payload[0].payload as Point) : null;
                  if (!p) return null;
                  return (
                    <div className="rounded-[12px] border border-border bg-card px-3 py-2 text-sm shadow-lg">
                      <p className="font-bold">{label(p.day)}</p>
                      <p className="text-muted-foreground">{t('trendTooltip', { n: p.validated })}</p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="validated" stroke="var(--primary)" strokeWidth={2} fill="url(#trendFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--primary)' }} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
