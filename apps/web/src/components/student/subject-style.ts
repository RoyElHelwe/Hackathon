import { TOPIC_EMOJI } from '@/components/app/subject-icon';

export interface SubjectLook {
  bg: string;
  soft: string;
  text: string;
  hex: string;
  emoji: string;
  /** darker edge (the 5–8px "press" bottom of chunky blocks and path nodes) */
  hexD: string;
}

/**
 * Subject colors (SUBJECT_COLORS in @tajriba/shared) → static Tailwind classes + hex, on the Arzino palette:
 * Math Mediterranean blue · Physics teal · Chemistry leaf green · Biology cedar · History flag red · Languages flame.
 * (The stored color names are the legacy ones; only their look changed.)
 */
const COLOR_STYLE: Record<string, Omit<SubjectLook, 'emoji'>> = {
  violet: { bg: 'bg-med', soft: 'bg-med-soft', text: 'text-med-ink dark:text-med', hex: '#1C8BE0', hexD: '#136CB2' },
  sky: { bg: 'bg-[#0AA3B4]', soft: 'bg-[#DDF4F6] dark:bg-[#0E3438]', text: 'text-[#07808D] dark:text-[#3CC7D6]', hex: '#0AA3B4', hexD: '#07808D' },
  mint: { bg: 'bg-green', soft: 'bg-green-soft', text: 'text-[#3E8F02] dark:text-green', hex: '#58CC02', hexD: '#46A302' },
  green: { bg: 'bg-cedar', soft: 'bg-cedar-soft', text: 'text-cedar-ink dark:text-cedar', hex: '#00A651', hexD: '#00843F' },
  coral: { bg: 'bg-flag', soft: 'bg-flag-soft', text: 'text-flag-d dark:text-flag', hex: '#E4252D', hexD: '#B3171E' },
  sunny: { bg: 'bg-flame', soft: 'bg-flame-soft', text: 'text-flame-d dark:text-flame', hex: '#FF9600', hexD: '#D97A00' },
  pink: { bg: 'bg-[#E8457E]', soft: 'bg-[#FCE4EE] dark:bg-[#3D1626]', text: 'text-[#B8305F] dark:text-[#F27AA5]', hex: '#E8457E', hexD: '#B8305F' },
  slate: { bg: 'bg-[#6B7C80]', soft: 'bg-muted', text: 'text-muted-foreground', hex: '#6B7C80', hexD: '#4B5C60' },
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

/** Look of a subject from the API's `color`/`icon`, falling back to the legacy key map, then blue/book. */
export function subjectStyle(key?: string | null, color?: string | null, icon?: string | null): SubjectLook {
  const legacy = key ? LEGACY[key] : undefined;
  const c = (color && COLOR_STYLE[color]) || COLOR_STYLE[legacy?.color ?? 'violet'];
  const emoji = (icon && ICON_EMOJI[icon]) || ICON_EMOJI[legacy?.icon ?? 'book'];
  return { ...c, emoji };
}

export { TOPIC_EMOJI };
export const topicEmoji = (key: string) => TOPIC_EMOJI[key] ?? '⭐';
