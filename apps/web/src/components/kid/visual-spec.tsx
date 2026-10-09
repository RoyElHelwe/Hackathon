import type { VisualSpec } from '@tajriba/shared';

/** AI color names (legacy + Arzino palette) → hex. Unknown names pass through as CSS colors. */
const COLORS: Record<string, string> = {
  violet: '#1C8BE0',
  mint: '#22C58B',
  sunny: '#FFC21A',
  coral: '#E4252D',
  sky: '#1C8BE0',
  green: '#58CC02',
  cedar: '#00A651',
  flag: '#E4252D',
  red: '#E4252D',
  med: '#1C8BE0',
  blue: '#1C8BE0',
  flame: '#FF9600',
  orange: '#FF9600',
  ink: 'currentColor',
};
const col = (c?: string) => (c ? (COLORS[c] ?? c) : COLORS.cedar);

/** Renders the AI "visualSpec" (simple shapes in a 0..100 viewBox) as an SVG illustration. */
export function VisualSpecView({ spec, className }: { spec: VisualSpec | null | undefined; className?: string }) {
  if (!spec?.shapes?.length) return null;
  return (
    <figure className={className}>
      <svg viewBox="-4 -4 108 108" className="h-auto w-full text-foreground" role="img" aria-label={spec.caption ?? 'Illustration'} style={{ direction: 'ltr' }}>
        {spec.shapes.map((s, i) => {
          switch (s.kind) {
            case 'rect':
              return (
                <g key={i}>
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={1.5} fill={col(s.color)} fillOpacity={0.85} />
                  {s.label && <text x={s.x + s.w / 2} y={s.y - 2} fontSize="4.5" textAnchor="middle" fontWeight="700" fill="currentColor">{s.label}</text>}
                </g>
              );
            case 'circle':
              return (
                <g key={i}>
                  <circle cx={s.cx} cy={s.cy} r={s.r} fill={col(s.color)} fillOpacity={0.9} />
                  {s.label && <text x={s.cx} y={s.cy + s.r + 5} fontSize="4.5" textAnchor="middle" fontWeight="700" fill="currentColor">{s.label}</text>}
                </g>
              );
            case 'polygon':
              return <polygon key={i} points={s.points.map((p) => p.join(',')).join(' ')} fill={col(s.color)} fillOpacity={0.35} stroke={col(s.color)} strokeWidth={0.8} />;
            case 'line': {
              const mx = (s.x1 + s.x2) / 2;
              const my = (s.y1 + s.y2) / 2;
              return (
                <g key={i}>
                  <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={col(s.color ?? 'ink')} strokeWidth={1.2} strokeDasharray={s.dashed ? '3 2' : undefined} strokeLinecap="round" />
                  {s.label && <text x={mx} y={my - 2} fontSize="4.5" textAnchor="middle" fontWeight="700" fill="currentColor">{s.label}</text>}
                </g>
              );
            }
            case 'text':
              return <text key={i} x={s.x} y={s.y} fontSize="6" fontWeight="800" fill={col(s.color ?? 'ink')}>{s.text}</text>;
          }
        })}
      </svg>
      {spec.caption && <figcaption className="mt-3 text-center text-sm font-extrabold text-muted-foreground">{spec.caption}</figcaption>}
    </figure>
  );
}
