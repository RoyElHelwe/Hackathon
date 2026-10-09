'use client';

import { Check, Lock, Star } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Fragment, useMemo } from 'react';
import { Arzino, type ArzinoMood } from '@/components/arzino';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { GraphNode } from '@/lib/types';

/** Duolingo zig-zag: horizontal offsets (px) repeated down the path. */
const ZIG = [0, 52, 78, 52, 0, -52, -78, -52];

/**
 * Topological order (prerequisites first), depth-first so a chain stays together on the path
 * (area → angles → similar triangles before the side branches); ties by grade, then the teacher's layout (y, then x).
 */
function orderNodes(nodes: GraphNode[], edges: { source: string; target: string }[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  }
  const key = (n: GraphNode) => [n.gradeLevel, n.position.y, n.position.x] as const;
  const cmp = (a: GraphNode, b: GraphNode) => {
    const ka = key(a);
    const kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  };
  const ready = nodes.filter((n) => !indeg.get(n.id)).sort(cmp);
  const order: GraphNode[] = [];
  while (ready.length) {
    const n = ready.shift()!;
    order.push(n);
    const freed: GraphNode[] = [];
    for (const t of out.get(n.id) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 1) - 1);
      if (indeg.get(t) === 0) freed.push(byId.get(t)!);
    }
    ready.unshift(...freed.sort(cmp));
  }
  // cycles (shouldn't happen): append what's left in layout order
  const seen = new Set(order.map((n) => n.id));
  return [...order, ...nodes.filter((n) => !seen.has(n.id)).sort(cmp)];
}

export interface PathGroup {
  grade: number;
  nodes: GraphNode[];
}

interface Props {
  nodes: GraphNode[];
  edges: { id: string; source: string; target: string }[];
  color: string;
  /** darker edge of the subject color */
  colorD?: string;
  onSelect: (n: GraphNode) => void;
  justUnlocked?: string[];
  /** unit banner drawn above each grade's stretch of the path */
  banner?: (group: PathGroup, index: number) => React.ReactNode;
}

/** The skill map as a Duolingo-style path: done = check, current = star with ring + START bubble, locked = grey lock. */
export function SkillMap({ nodes, edges, color, colorD, onSelect, justUnlocked = [], banner }: Props) {
  const groups = useMemo<PathGroup[]>(() => {
    const ordered = orderNodes(nodes, edges);
    const out: PathGroup[] = [];
    for (const n of ordered) {
      const g = out.find((x) => x.grade === n.gradeLevel);
      if (g) g.nodes.push(n);
      else out.push({ grade: n.gradeLevel, nodes: [n] });
    }
    return out;
  }, [nodes, edges]);
  const current = groups.flatMap((g) => g.nodes).find((n) => n.state === 'IN_PROGRESS' || n.state === 'AVAILABLE')?.id;
  const edge = colorD ?? `color-mix(in srgb, ${color} 78%, black)`;
  let i = 0;

  return (
    <div className="space-y-6" data-testid="skill-map">
      {groups.map((g, gi) => {
        const hasCurrent = g.nodes.some((n) => n.id === current);
        const decoIndex = hasCurrent ? g.nodes.findIndex((n) => n.id === current) : Math.min(g.nodes.length - 1, 2);
        return (
          <Fragment key={g.grade}>
            {banner?.(g, gi)}
            <ol className="flex flex-col items-stretch gap-7 py-3">
              {g.nodes.map((n, ni) => {
                const offset = ZIG[i++ % ZIG.length];
                const deco: ArzinoMood | null = ni === decoIndex ? (hasCurrent ? 'reading' : gi % 2 ? 'cool' : 'writing') : null;
                return (
                  <li key={n.id} className={cn('relative flex justify-center', n.id === current && 'mt-10')}>
                    {deco && (
                      <div className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2', offset >= 0 ? 'left-0 sm:left-4' : 'right-0 sm:right-4')} aria-hidden>
                        <Arzino mood={deco} size={108} className="sm:hidden" title="" />
                        <Arzino mood={deco} size={150} className="hidden sm:inline-flex" title="" />
                      </div>
                    )}
                    <div style={{ transform: `translateX(${offset}px)` }}>
                      <PathNode node={n} color={color} edge={edge} isCurrent={n.id === current} unlocked={justUnlocked.includes(n.id)} onSelect={onSelect} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </Fragment>
        );
      })}
    </div>
  );
}

function PathNode({ node, color, edge, isCurrent, unlocked, onSelect }: { node: GraphNode; color: string; edge: string; isCurrent: boolean; unlocked: boolean; onSelect: (n: GraphNode) => void }) {
  const t = useTranslations('student');
  const l = useL();
  const reduce = useReducedMotion();
  const s = node.state;
  const locked = s === 'LOCKED';
  const ringPct = s === 'IN_PROGRESS' ? Math.max(0.25, Math.min(0.95, (node.bestScore || 50) / 100)) : 0;
  const C = 2 * Math.PI * 50;

  return (
    <div className="flex w-[150px] flex-col items-center gap-2">
      <div className="relative">
        {isCurrent && (
          <>
            <svg className="pointer-events-none absolute left-1/2 top-1/2 size-[104px] -translate-x-1/2 -translate-y-[46%] -rotate-90" viewBox="0 0 112 112" aria-hidden>
              <circle cx="56" cy="56" r="50" fill="none" stroke="var(--lock)" strokeWidth="9" />
              {ringPct > 0 && <circle cx="56" cy="56" r="50" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ringPct)} />}
            </svg>
            <motion.span
              className="absolute -top-[54px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[14px] border-2 border-border bg-card px-3.5 py-1.5 text-[15px] font-black uppercase tracking-[0.08em] shadow-[0_3px_0_var(--border)]"
              style={{ color }}
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            >
              {s === 'IN_PROGRESS' ? t('jumpIn') : t('start')}
              <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-border bg-card" />
            </motion.span>
          </>
        )}
        <motion.button
          type="button"
          onClick={() => onSelect(node)}
          initial={unlocked ? { scale: 0.5, filter: 'grayscale(1)' } : false}
          animate={{ scale: 1, filter: 'grayscale(0)' }}
          transition={{ type: 'spring', stiffness: 240, damping: 9, delay: unlocked ? 0.5 : 0 }}
          className={cn(
            'relative flex h-[68px] w-[74px] cursor-pointer items-center justify-center rounded-[50%] text-white transition-[transform,box-shadow] duration-100 active:translate-y-[6px]',
          )}
          style={{
            background: locked ? 'var(--lock)' : color,
            boxShadow: `0 8px 0 0 ${locked ? 'var(--lock-d)' : edge}`,
            ['--node-color' as string]: color,
          }}
          aria-label={`${l(node.name)} · ${s}`}
          data-testid={`map-node-${node.key}`}
          data-state={s}
        >
          {unlocked && <span className="pulse-ring pointer-events-none absolute inset-0 rounded-[50%]" aria-hidden />}
          <span className="pointer-events-none absolute inset-x-3 top-2 h-3 rounded-full bg-white/25" aria-hidden />
          {locked ? (
            <Lock className="size-7 text-lock-d dark:text-muted-foreground" strokeWidth={2.8} fill="currentColor" fillOpacity={0.35} />
          ) : s === 'MASTERED' ? (
            <Check className="size-9" strokeWidth={4} />
          ) : (
            <Star className="size-8 fill-white" strokeWidth={2} />
          )}
          {s === 'MASTERED' && (
            <span className="absolute -end-2 -top-2 flex size-7 items-center justify-center rounded-full border-2 border-card bg-[#FFC21A] shadow-[0_2px_0_#E0A800]" aria-hidden>
              <Star className="size-3.5 fill-white text-white" />
            </span>
          )}
        </motion.button>
      </div>
      <span className={cn('max-w-[150px] text-center text-sm font-extrabold leading-tight', isCurrent ? 'mt-5' : 'mt-1', locked ? 'text-muted-foreground' : 'text-foreground')}>{l(node.name)}</span>
    </div>
  );
}
