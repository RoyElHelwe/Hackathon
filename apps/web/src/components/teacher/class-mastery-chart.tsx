'use client';

import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Row {
  name: string;
  mastery: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  const t = useTranslations('teacher.insights');
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[12px] border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="font-bold">{label}</p>
      <p className="text-muted-foreground">{t('masteryTooltip', { n: payload[0].value })}</p>
    </div>
  );
}

/** Single-series bar chart: average mastery per class (0–100%). */
export function ClassMasteryChart({ rows }: { rows: Row[] }) {
  const t = useTranslations('teacher.insights');
  return (
    <div className="h-64 w-full" style={{ direction: 'ltr' }} role="img" aria-label={t('chartTitle')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} unit="%" />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<ChartTooltip />} />
          <Bar dataKey="mastery" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={56}>
            <LabelList dataKey="mastery" position="top" formatter={(v: unknown) => `${v}%`} style={{ fill: 'var(--foreground)', fontSize: 12, fontWeight: 800 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
