import { z } from 'zod';
import { defineTask, JSON_RULES } from '../task';

export interface ParseCoursesInput {
  /** Classroom courses (names only — never rosters) */
  courses: { id: string; name: string; section: string }[];
  /** school subjects; `name` is "English | Arabic" */
  subjects: { id: string; name: string }[];
}

const nullableInt = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}, z.number().int().nullable());

const nullableText = z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 20) : null), z.string().nullable());

export const parseCoursesOutput = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      subjectId: z.preprocess((v) => (typeof v === 'string' && v ? v : null), z.string().nullable()),
      gradeLevel: nullableInt,
      sectionLabel: nullableText,
      confidence: z.preprocess((v) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : 0.5), z.number()),
    }),
  ),
});
export type ParseCoursesOutput = z.infer<typeof parseCoursesOutput>;

// ---------- Deterministic heuristic (mock + reference behaviour) ----------

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

/** Arabic ordinal grade words, longest first ("الحادي عشر" before "الحادي"). */
const AR_ORDINALS: [RegExp, number][] = [
  [/(ال)?حادي\s*عشر/, 11],
  [/(ال)?ثاني\s*عشر/, 12],
  [/(ال)?[أا]ول/, 1],
  [/(ال)?ثاني/, 2],
  [/(ال)?ثالث/, 3],
  [/(ال)?رابع/, 4],
  [/(ال)?خامس/, 5],
  [/(ال)?سادس/, 6],
  [/(ال)?سابع/, 7],
  [/(ال)?ثامن/, 8],
  [/(ال)?تاسع/, 9],
  [/(ال)?عاشر/, 10],
];
const AR_SECTION: Record<string, string> = { أ: 'A', ا: 'A', ب: 'B', ج: 'C', د: 'D', ه: 'E', و: 'F', ز: 'G', ح: 'H' };

function grade(text: string): number | null {
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})(?!\d)/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return n;
  }
  for (const [re, n] of AR_ORDINALS) if (re.test(text)) return n;
  return null;
}

function section(text: string): string | null {
  const adj = text.match(/(?<!\d)\d{1,2}\s?([A-Ha-h])(?![A-Za-zÀ-ÿ])/);
  if (adj) return adj[1].toUpperCase();
  const named = text.match(/\b(?:section|sec\.?|div\.?|groupe?)\s*:?\s*([A-Ha-h])(?![A-Za-z])/i);
  if (named) return named[1].toUpperCase();
  const dash = text.match(/[-–—]\s*([A-Ha-h])(?![A-Za-zÀ-ÿ])/);
  if (dash) return dash[1].toUpperCase();
  const trailing = text.match(/(?:^|\s)([A-Ha-h])\s*$/);
  if (trailing) return trailing[1].toUpperCase();
  const ar = text.split(/[\s\-–—_/]+/).find((tok) => tok in AR_SECTION);
  return ar ? AR_SECTION[ar] : null;
}

const stripAl = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^ال/, ''))
    .join(' ')
    .trim();

function subject(text: string, subjects: ParseCoursesInput['subjects']): string | null {
  const hay = stripAl(text);
  for (const s of subjects) {
    for (const raw of s.name.split('|')) {
      const n = stripAl(raw);
      if (!n) continue;
      if (hay.includes(n) || (n.length >= 4 && hay.includes(n.slice(0, 4)))) return s.id;
    }
  }
  return null;
}

export function heuristicParseCourses(i: ParseCoursesInput): ParseCoursesOutput {
  return {
    items: i.courses.map((c) => {
      const text = toLatinDigits(`${c.name} ${c.section ?? ''}`.trim());
      const subjectId = subject(text, i.subjects);
      const gradeLevel = grade(text);
      return {
        id: c.id,
        subjectId,
        gradeLevel,
        sectionLabel: section(text),
        confidence: subjectId && gradeLevel ? 0.9 : subjectId || gradeLevel ? 0.6 : 0.2,
      };
    }),
  };
}

/** Classroom course names → (subject, grade, section) suggestions for the grouped import. One call per teacher. */
export const parseCourses = defineTask({
  name: 'parseCourses',
  model: 'fast',
  schema: parseCoursesOutput,
  system: `You classify a teacher's Google Classroom courses for a Lebanese school. Each course is one SECTION of a grade + subject.
For every course, read its name and section (English, Arabic or French; often abbreviated) and return:
- "subjectId": the id of the matching school subject from the given list, or null if none clearly matches. Match by meaning across languages
  (e.g. "Math", "Maths", "Mathématiques", "رياضيات", "الرياضيات" → the mathematics subject; "Sciences physiques"/"فيزياء" → physics).
- "gradeLevel": the school grade 1-12 as an integer, or null. Read digits ("6A", "Grade 6", "G6", "6ème", "6e", "EB6", "٦") and
  Arabic ordinals (الأول=1, الثاني=2, الثالث=3, الرابع=4, الخامس=5, السادس=6, السابع=7, الثامن=8, التاسع=9, العاشر=10, الحادي عشر=11, الثاني عشر=12).
  Do not confuse years ("2026"), room numbers or counts with the grade.
- "sectionLabel": the section letter as an uppercase Latin letter ("6A" → "A", "Grade 6 – Math – B" → "B", "Section C" → "C",
  Arabic letters أ=A, ب=B, ج=C, د=D, ه=E, و=F), or null if there is none.
- "confidence": 0..1, how sure you are about subjectId AND gradeLevel together.
Never invent ids: subjectId must be one of the listed ids or null. Return one item per input course, same ids.
Examples: "رياضيات السادس ج" → math, 6, "C". "Maths 6ème B" → math, 6, "B". "Grade 6 – Math – B" → math, 6, "B".
${JSON_RULES}
Schema: {"items":[{"id":string,"subjectId":string|null,"gradeLevel":number|null,"sectionLabel":string|null,"confidence":number}]}`,
  user: (i: ParseCoursesInput) =>
    `School subjects (id: English | Arabic):
${i.subjects.map((s) => `- ${s.id}: ${s.name}`).join('\n') || '- (none)'}

Classroom courses (id: name / section):
${i.courses.map((c) => `- ${c.id}: ${c.name}${c.section ? ` / ${c.section}` : ''}`).join('\n')}`,
  mock: heuristicParseCourses,
});
