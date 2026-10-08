export const SUBJECT_STYLE: Record<string, { bg: string; soft: string; text: string; hex: string; emoji: string }> = {
  math: { bg: 'bg-violet', soft: 'bg-violet-soft', text: 'text-violet', hex: '#6C4CF1', emoji: '📐' },
  physics: { bg: 'bg-sky', soft: 'bg-sky-soft', text: 'text-sky', hex: '#4CB8FF', emoji: '⚡' },
  chemistry: { bg: 'bg-mint', soft: 'bg-mint-soft', text: 'text-mint', hex: '#2DD4A7', emoji: '🧪' },
  biology: { bg: 'bg-green', soft: 'bg-green-soft', text: 'text-green', hex: '#5CC45C', emoji: '🌿' },
  history: { bg: 'bg-coral', soft: 'bg-coral-soft', text: 'text-coral', hex: '#FF7A59', emoji: '🏛️' },
  languages: { bg: 'bg-sunny', soft: 'bg-sunny-soft', text: 'text-sunny', hex: '#FFC83D', emoji: '💬' },
};
export const subjectStyle = (key?: string) => SUBJECT_STYLE[key ?? 'math'] ?? SUBJECT_STYLE.math;

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
export const topicEmoji = (key: string) => TOPIC_EMOJI[key] ?? '⭐';
