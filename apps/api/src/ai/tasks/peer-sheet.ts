import { peerSheetOutput, RubricItem } from '@tajriba/shared';
import { defineTask, JSON_RULES, lang } from '../task';

export interface PeerSheetInput {
  topicKey: string;
  missionTitle: string;
  rubric: RubricItem[];
  submissionSummary: string;
  locale: string;
}

const SIMILAR_QUESTIONS = [
  'Did you measure your shadow and the building shadow at the same time? Why does it matter?',
  'Which ratio did you use, and why are the two triangles similar?',
  'Is the building height you found realistic for the number of floors?',
];

export const peerSheet = defineTask({
  name: 'peerSheet',
  model: 'fast',
  schema: peerSheetOutput,
  system: `You prepare a peer-evaluation sheet so a 13-year-old can fairly evaluate a classmate's mission (42-school style peer review).
${JSON_RULES}
Schema: {"checklist":[{"criterion":string,"whatToLookFor":string}],"questionsToAsk":[string,string,string],"commonMistakes":string[]}`,
  user: (i: PeerSheetInput) =>
    `Mission: ${i.missionTitle} (${i.topicKey}). Rubric: ${JSON.stringify(i.rubric)}. Submission summary: ${i.submissionSummary}. Language: ${lang(i.locale)}.`,
  mock: (i: PeerSheetInput) => ({
    checklist: i.rubric.map((r) => ({ criterion: r.criterion, whatToLookFor: r.description })),
    questionsToAsk:
      i.topicKey === 'geo.similar'
        ? SIMILAR_QUESTIONS
        : ['What did you measure first, and how?', 'Which formula did you use and why?', 'Is your final answer realistic? How do you know?'],
    commonMistakes:
      i.topicKey === 'geo.similar'
        ? ['Measuring the shadows at different times of day', 'Mixing centimeters and meters', 'Inverting the ratio (s/h instead of h/s)']
        : ['Forgetting units', 'Copying the formula without explaining it'],
  }),
});
