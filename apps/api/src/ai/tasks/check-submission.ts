import { checkSubmissionOutput, RubricItem } from '@tajriba/shared';
import { defineTask, JSON_RULES, lang, stableNumber } from '../task';
import { FOLLOW_UPS } from './mock-bank';

export interface CheckSubmissionInput {
  topicKey: string;
  missionTitle: string;
  steps: string[];
  rubric: RubricItem[];
  explanation: string;
  answers: Record<string, string | number>;
  photoCount: number;
  locale: string;
}

export const checkSubmission = defineTask({
  name: 'checkSubmission',
  model: 'vision',
  schema: checkSubmissionOutput,
  system: `You are Bousla, an encouraging AI coach checking a 13-year-old's real-life mission proof (photos + numbers + explanation).
Score 0-100 using the rubric. Be kind and specific; never say "failed". Feedback <= 60 words, encouraging, spoken directly to the student as "you" (never "the student").
Always ask ONE follow-up question that checks real understanding (not a yes/no question).
Add flags when relevant: "photo_unrelated" (photos don't show the task), "numbers_unrealistic", "explanation_missing".
${JSON_RULES}
Schema: {"score":integer,"correct":boolean,"perCriterion":[{"criterion":string,"score":number,"comment":string}],"feedback":string,"followUpQuestion":string,"flags":string[]}`,
  user: (i: CheckSubmissionInput) =>
    `Mission: ${i.missionTitle} (topic ${i.topicKey}). Steps: ${i.steps.join(' | ')}
Rubric: ${JSON.stringify(i.rubric)}
Numbers reported: ${JSON.stringify(i.answers)}
Explanation: """${i.explanation}"""
${i.photoCount} photo(s) attached. Respond in ${lang(i.locale)}.`,
  mock: (i: CheckSubmissionInput) => {
    const thin = i.explanation.trim().length < 15 && i.photoCount === 0;
    const score = thin ? 35 : 82 + stableNumber(i.explanation, 9);
    const ar = i.locale === 'ar';
    const fu = FOLLOW_UPS[i.topicKey] ?? { en: 'Can you explain in your own words why your method works?', ar: 'هل يمكنك أن تشرح بكلماتك لماذا تنجح طريقتك؟' };
    return {
      score,
      correct: score >= 70,
      perCriterion: i.rubric.map((r, idx) => ({
        criterion: r.criterion,
        score: Math.max(0, Math.min(100, score + (idx === 1 ? 4 : idx === 2 ? -6 : 0))),
        comment: thin ? (ar ? 'نحتاج إلى المزيد من التفاصيل.' : 'We need more detail here.') : ar ? 'عمل جيد!' : 'Nice work here!',
      })),
      feedback: thin
        ? ar
          ? 'بداية جيدة! أضف صورة لقياساتك واشرح خطواتك بجملتين على الأقل.'
          : 'Good start! Add a photo of your measurements and explain your steps in at least two sentences.'
        : ar
          ? 'رائع! قياساتك واقعية وطريقتك صحيحة. انتبه لكتابة الوحدات دائماً.'
          : 'Great job! Your measurements are realistic and your method is right. Remember to always write the units.',
      followUpQuestion: ar ? fu.ar : fu.en,
      flags: thin ? ['explanation_missing'] : [],
    };
  },
});
