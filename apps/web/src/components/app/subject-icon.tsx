import {
  BookOpen,
  Box,
  Circle,
  Cpu,
  Dumbbell,
  FlaskConical,
  Gauge,
  Globe,
  Landmark,
  Languages,
  Leaf,
  Mic,
  Music,
  Palette,
  Ruler,
  Square,
  Star,
  Triangle,
  TriangleRight,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/** Subject icons (SUBJECT_ICONS in @tajriba/shared) → lucide. */
export const SUBJECT_ICON: Record<string, LucideIcon> = {
  triangle: Triangle,
  zap: Zap,
  flask: FlaskConical,
  leaf: Leaf,
  landmark: Landmark,
  languages: Languages,
  book: BookOpen,
  globe: Globe,
  music: Music,
  palette: Palette,
  cpu: Cpu,
  dumbbell: Dumbbell,
};

/** Skill icons (seeded topics + the AI's SKILL_ICONS) → lucide; anything else is a star. */
export const TOPIC_ICON: Record<string, LucideIcon> = {
  ...SUBJECT_ICON,
  star: Star,
  square: Square,
  cube: Box,
  angle: TriangleRight,
  circle: Circle,
  ruler: Ruler,
  mic: Mic,
  gauge: Gauge,
};

export const subjectIcon = (icon?: string | null): LucideIcon => (icon && SUBJECT_ICON[icon]) || BookOpen;
export const topicIcon = (icon?: string | null): LucideIcon => (icon && TOPIC_ICON[icon]) || Star;

export function SubjectIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = subjectIcon(icon);
  return <Icon className={cn('size-4', className)} aria-hidden />;
}

/** Hand-picked emoji for the seeded demo topics; lesson skills use their lucide icon. */
export const TOPIC_EMOJI: Record<string, string> = {
  'geo.area': '🟩',
  'geo.angles': '📐',
  'geo.similar': '🌓',
  'geo.circles': '🍕',
  'geo.volume': '🛢️',
  'geo.pythagoras': '📺',
  'phy.speed': '🏃',
  'chem.kitchen': '🧪',
  'his.oral': '🎙️',
};

/** A skill's glyph: the demo emoji when there is one, otherwise the skill's icon (star fallback). */
export function TopicGlyph({ topicKey, icon, className }: { topicKey?: string | null; icon?: string | null; className?: string }) {
  const emoji = topicKey ? TOPIC_EMOJI[topicKey] : undefined;
  if (emoji) return <span aria-hidden>{emoji}</span>;
  const Icon = topicIcon(icon);
  return <Icon className={cn('size-[1em]', className)} aria-hidden />;
}
