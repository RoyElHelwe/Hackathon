/**
 * Deterministic safety pre-filter for missions. Runs before (and in addition to) the AI safety check,
 * so an unsafe mission is rejected even if the model misses it.
 */
const RULES: { issue: string; patterns: RegExp[] }[] = [
  { issue: 'Heights or climbing', patterns: [/\bclimb/i, /\broof ?(edge|top)\b/i, /\bladder\b/i, /\bbalcony (rail|edge)\b/i, /تسلق/] },
  { issue: 'Fire or open flames', patterns: [/\bfire\b/i, /\bflame/i, /\blighter\b/i, /\bmatches\b/i, /\bburn(ing)?\b/i, /نار/] },
  { issue: 'Sharp tools without an adult', patterns: [/\bknife\b/i, /\bknives\b/i, /\bblade\b/i, /\bsaw\b/i, /\bscissors\b/i] },
  { issue: 'Chemicals beyond kitchen-safe', patterns: [/\bbleach\b/i, /\bacid\b/i, /\bammonia\b/i, /\bgasoline\b/i, /\bpetrol\b/i] },
  { issue: 'Going out alone or at night', patterns: [/\balone\b/i, /\bat night\b/i, /\bafter dark\b/i, /\bmidnight\b/i, /وحدك/] },
  { issue: 'Contacting strangers', patterns: [/\bstranger/i, /\bask (a )?passer/i, /\bknock on (a )?neighbou?r'?s? door/i] },
  { issue: 'Sharing location', patterns: [/\bshare (your )?location\b/i, /\bhome address\b/i, /\bgps coordinates\b/i] },
];

const ADULT_PRESENT = /\b(with an adult|adult (helps|supervis)|parent (helps|supervis)|with a parent)\b/i;

export function safetyPrefilter(text: string): string[] {
  const issues: string[] = [];
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      if (rule.issue === 'Sharp tools without an adult' && ADULT_PRESENT.test(text)) continue;
      issues.push(rule.issue);
    }
  }
  return issues;
}

/** Flattens any JSON mission content into searchable text. */
export function missionText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(missionText).join(' ');
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(missionText).join(' ');
  return '';
}
