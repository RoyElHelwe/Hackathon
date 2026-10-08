import { miniLessonOutput } from '@tajriba/shared';
import { defineTask, JSON_RULES, lang } from '../task';
import { AREA_VISUAL } from './mock-bank';

export interface MiniLessonInput {
  topicName: string;
  topicDescription: string;
  locale: string;
}

export const miniLesson = defineTask({
  name: 'miniLesson',
  model: 'fast',
  schema: miniLessonOutput,
  system: `You write 60-second lessons for 13-year-olds: friendly, concrete, max 120 words, one key idea.
${JSON_RULES}
Schema: {"text":string,"visualSpec":{"caption":string,"shapes":[...simple shapes in a 0-100 viewBox...]}}`,
  user: (i: MiniLessonInput) => `Topic: ${i.topicName}. ${i.topicDescription}. Language: ${lang(i.locale)}.`,
  mock: (i: MiniLessonInput) => ({ text: `${i.topicName}: ${i.topicDescription}`, visualSpec: AREA_VISUAL }),
});
