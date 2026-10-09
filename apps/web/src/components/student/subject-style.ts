import { TOPIC_EMOJI } from '@/components/app/subject-icon';

export interface SubjectLook {
  bg: string;
  soft: string;
  text: string;
  hex: string;
  emoji: string;
}

/** Subject colors (SUBJECT_COLORS in @tajriba/shared) → static Tailwind classes + hex for the map. */
const COLOR_STYLE: Record<string, Omit<SubjectLook, 'emoji'>> = {
  violet: { bg: 'bg-violet', soft: 'bg-violet-soft', text: 'text-violet', hex: '#6C4CF1' },
  sky: { bg: 'bg-sky', soft: 'bg-sky-soft', text: 'text-sky', hex: '#4CB8FF' },
  mint: { bg: 'bg-mint', soft: 'bg-mint-soft', text: 'text-mint', hex: '#2DD4A7' },
  green: { bg: 'bg-green', soft: 'bg-green-soft', text: 'text-green', hex: '#5CC45C' },
  coral: { bg: 'bg-coral', soft: 'bg-coral-soft', text: 'text-coral', hex: '#FF7A59' },
  sunny: { bg: 'bg-sunny', soft: 'bg-sunny-soft', text: 'text-sunny', hex: '#FFC83D' },
  pink: { bg: 'bg-coral', soft: 'bg-coral-soft', text: 'text-coral', hex: '#F25C9A' },
  slate: { bg: 'bg-muted-foreground', soft: 'bg-muted', text: 'text-muted-foreground', hex: '#64748B' },
};

/** Subject icon (SUBJECT_ICONS) → emoji for the kid UI. */
const ICON_EMOJI: Record<string, string> = {
  triangle: '📐',
  zap: '⚡',
  flask: '🧪',
  leaf: '🌿',
  landmark: '🏛️',
  languages: '💬',
  book: '📘',
  globe: '🌍',
  music: '🎵',
  palette: '🎨',
  cpu: '💻',
  dumbbell: '🏋️',
};

/** Legacy demo subject keys (used when the API gives no color/icon). */
const LEGACY: Record<string, { color: string; icon: string }> = {
  math: { color: 'violet', icon: 'triangle' },
  physics: { color: 'sky', icon: 'zap' },
  chemistry: { color: 'mint', icon: 'flask' },
  biology: { color: 'green', icon: 'leaf' },
  history: { color: 'coral', icon: 'landmark' },
  languages: { color: 'sunny', icon: 'languages' },
};

/** Look of a subject from the API's `color`/`icon`, falling back to the legacy key map, then violet/book. */
export function subjectStyle(key?: string | null, color?: string | null, icon?: string | null): SubjectLook {
  const legacy = key ? LEGACY[key] : undefined;
  const c = (color && COLOR_STYLE[color]) || COLOR_STYLE[legacy?.color ?? 'violet'];
  const emoji = (icon && ICON_EMOJI[icon]) || ICON_EMOJI[legacy?.icon ?? 'book'];
  return { ...c, emoji };
}

export { TOPIC_EMOJI };
export const topicEmoji = (key: string) => TOPIC_EMOJI[key] ?? '⭐';
