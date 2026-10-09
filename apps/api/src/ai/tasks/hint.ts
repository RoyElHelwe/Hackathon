import { hintOutput } from '@tajriba/shared';
import { defineTask, JSON_RULES, lang } from '../task';

export interface HintInput {
  topicKey: string;
  missionTitle: string;
  steps: string[];
  partialWork?: string;
  level: number;
  locale: string;
}

const MOCK: Record<string, string[]> = {
  'geo.similar': [
    'Look at the two triangles: you + your shadow, and the building + its shadow. What do they have in common?',
    'The sun hits both at the same angle, so the ratios are equal: your height ÷ your shadow = building height ÷ building shadow.',
    'Put your numbers in: H = S × (h ÷ s). Multiply the building shadow by your height-to-shadow ratio.',
  ],
};
const MOCK_AR: Record<string, string[]> = {
  'geo.similar': [
    'انظر إلى المثلثين: أنت وظلّك، والمبنى وظلّه. ما المشترك بينهما؟',
    'الشمس تسقط عليهما بالزاوية نفسها، لذلك النسب متساوية: طولك ÷ ظلّك = ارتفاع المبنى ÷ ظلّ المبنى.',
    'عوّض بأرقامك: H = S × (h ÷ s).',
  ],
};
const GENERIC = [
  'Re-read the story: what real thing are you measuring?',
  'Write down what you know and what you need to find. Which formula links them?',
  'Try the formula with your numbers, then check if the answer is realistic.',
];

export const hint = defineTask({
  name: 'hint',
  model: 'fast',
  schema: hintOutput,
  system: `You are Arzino, a friendly little cedar-tree mascot coaching a 13-year-old. Give ONE hint at the requested level:
level 1 = a guiding question, level 2 = the key idea, level 3 = how to set up the calculation. NEVER give the final answer or final number.
Max 40 words. Speak directly to the student as "you" (never "the student"). ${JSON_RULES}
Schema: {"hint":string}`,
  user: (i: HintInput) =>
    `Mission: ${i.missionTitle}. Topic: ${i.topicKey}. Steps: ${i.steps.join(' | ')}.
Student's partial work: ${i.partialWork || '(none yet)'}. Hint level: ${i.level}. Language: ${lang(i.locale)}.`,
  mock: (i: HintInput) => {
    const bank = (i.locale === 'ar' ? MOCK_AR : MOCK)[i.topicKey] ?? GENERIC;
    return { hint: bank[Math.min(i.level, 3) - 1] };
  },
});
