'use client';

import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BAND_VAR, band } from './helpers';

interface Row {
  name: string;
  mastery: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  const t = useTranslations('teacher.insights');
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[14px] border-2 border-border bg-card px-3 py-2 text-sm shadow-[0_4px_0_0_var(--border)]">
      <p className="font-black">{label}</p>
      <p className="font-semibold text-muted-foreground">{t('masteryTooltip', { n: payload[0].value })}</p>
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
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--foreground)', fontSize: 13, fontWeight: 800 }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 700 }} unit="%" />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<ChartTooltip />} />
          <ReferenceLine y={50} stroke="var(--lock-d)" strokeDasharray="4 4" />
          <Bar dataKey="mastery" radius={[10, 10, 4, 4]} maxBarSize={64}>
            {rows.map((r) => (
              <Cell key={r.name} fill={BAND_VAR[band(r.mastery)]} />
            ))}
            <LabelList dataKey="mastery" position="top" formatter={(v: unknown) => `${v}%`} style={{ fill: 'var(--foreground)', fontSize: 13, fontWeight: 900 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
