'use client';

import { Background, BaseEdge, type Edge, type EdgeProps, getBezierPath, Handle, type Node, type NodeProps, Position, ReactFlow, ReactFlowProvider, Controls } from '@xyflow/react';
import { Lock, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { memo, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { GraphNode } from '@/lib/types';
import { topicEmoji } from './subject-style';

type TopicData = { node: GraphNode; color: string; label: string; justUnlocked: boolean };
type TopicNodeT = Node<TopicData, 'topic'>;

const TopicNode = memo(function TopicNode({ data }: NodeProps<TopicNodeT>) {
  const { node, color, label, justUnlocked } = data;
  const s = node.state;
  return (
    <div className="flex w-[124px] cursor-pointer flex-col items-center gap-2" data-testid={`map-node-${node.key}`} data-state={s}>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <motion.div
        initial={justUnlocked ? { scale: 0.6, filter: 'grayscale(1)' } : false}
        animate={{ scale: 1, filter: 'grayscale(0)' }}
        transition={{ type: 'spring', stiffness: 220, damping: 10, delay: justUnlocked ? 0.6 : 0 }}
        className={cn(
          'relative flex size-[84px] items-center justify-center rounded-full border-[5px] text-4xl shadow-lg',
          s === 'LOCKED' && 'border-border bg-muted grayscale',
          s === 'AVAILABLE' && 'pulse-ring border-white',
          s === 'IN_PROGRESS' && 'border-sunny',
          s === 'MASTERED' && 'border-[#F5B700] shadow-[0_0_0_4px_rgba(255,200,61,0.35)]',
        )}
        style={{ background: s === 'LOCKED' ? undefined : color, ['--node-color' as string]: color }}
      >
        <span className={cn(s === 'LOCKED' && 'opacity-40')} aria-hidden>
          {topicEmoji(node.key)}
        </span>
        {s === 'LOCKED' && (
          <span className="absolute -bottom-1 -end-1 flex size-8 items-center justify-center rounded-full bg-card shadow">
            <Lock className="size-4 text-muted-foreground" />
          </span>
        )}
        {s === 'MASTERED' && (
          <span className="absolute -end-2 -top-2 flex size-9 items-center justify-center rounded-full bg-sunny shadow-md">
            <Star className="size-5 fill-white text-white" />
          </span>
        )}
        {s === 'IN_PROGRESS' && (
          <svg className="absolute -inset-[9px] size-[102px] -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke="#FFC83D" strokeWidth="5" strokeDasharray="289" strokeDashoffset="150" strokeLinecap="round" />
          </svg>
        )}
      </motion.div>
      <span className={cn('rounded-full bg-card/90 px-3 py-1 text-center text-sm font-extrabold leading-tight shadow-sm', s === 'LOCKED' && 'text-muted-foreground')}>{label}</span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});

type GlowEdgeT = Edge<{ active: boolean; glow: boolean; color: string }, 'glow'>;

function GlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<GlowEdgeT>) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const active = data?.active;
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: active ? data?.color : 'var(--border)', strokeWidth: 5, strokeDasharray: active ? undefined : '8 8', opacity: active ? 0.7 : 1 }} />
      {data?.glow && (
        <circle r="9" fill="#FFC83D" style={{ filter: 'drop-shadow(0 0 8px #FFC83D)' }}>
          <animateMotion dur="1.4s" repeatCount="3" path={path} />
        </circle>
      )}
    </>
  );
}

const nodeTypes = { topic: TopicNode };
const edgeTypes = { glow: GlowEdge };

export function SkillMap({ nodes, edges, color, onSelect, justUnlocked = [] }: { nodes: GraphNode[]; edges: { id: string; source: string; target: string }[]; color: string; onSelect: (n: GraphNode) => void; justUnlocked?: string[] }) {
  const l = useL();
  const rfNodes = useMemo<TopicNodeT[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: 'topic',
        position: n.position,
        data: { node: n, color, label: l(n.name), justUnlocked: justUnlocked.includes(n.id) },
        draggable: false,
      })),
    [nodes, color, l, justUnlocked],
  );
  const rfEdges = useMemo<GlowEdgeT[]>(() => {
    const state = new Map(nodes.map((n) => [n.id, n.state]));
    return edges.map((e) => ({
      ...e,
      type: 'glow',
      data: { active: state.get(e.source) === 'MASTERED', glow: justUnlocked.includes(e.target), color },
    }));
  }, [edges, nodes, color, justUnlocked]);

  return (
    <div className="h-[62vh] min-h-[420px] w-full overflow-hidden rounded-[24px] border-2 border-border bg-card" dir="ltr" data-testid="skill-map">
      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.4}
          maxZoom={1.8}
          nodesConnectable={false}
          nodesDraggable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, n) => onSelect((n as TopicNodeT).data.node)}
        >
          <Background gap={22} size={2} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
