import { checkFollowUpOutput } from '@tajriba/shared';
import { defineTask, JSON_RULES, lang } from '../task';

export interface CheckFollowUpInput {
  question: string;
  answer: string;
  missionTitle: string;
  locale: string;
}

export const checkFollowUp = defineTask({
  name: 'checkFollowUp',
  model: 'fast',
  schema: checkFollowUpOutput,
  system: `You check whether a 13-year-old really understood their mission, from their answer to a follow-up question.
scoreDelta between -10 and +10. Feedback: 1-2 kind sentences. ${JSON_RULES}
Schema: {"understood":boolean,"scoreDelta":integer,"feedback":string}`,
  user: (i: CheckFollowUpInput) => `Mission: ${i.missionTitle}\nQuestion: ${i.question}\nAnswer: """${i.answer}"""\nLanguage: ${lang(i.locale)}`,
  mock: (i: CheckFollowUpInput) => {
    const understood = i.answer.trim().split(/\s+/).length >= 4;
    const ar = i.locale === 'ar';
    return understood
      ? { understood, scoreDelta: 5, feedback: ar ? 'ممتاز! فهمت الفكرة جيداً.' : 'Exactly! You really understood the idea.' }
      : { understood, scoreDelta: -5, feedback: ar ? 'قريب! فكّر في السبب أكثر.' : 'Close! Think a bit more about the "why".' };
  },
});
