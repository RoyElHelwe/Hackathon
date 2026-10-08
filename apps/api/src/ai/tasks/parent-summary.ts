import { parentSummaryOutput } from '@tajriba/shared';
import { defineTask, JSON_RULES, lang } from '../task';

export interface ParentSummaryInput {
  locale: string;
  validated: { title: string; topic: string; score: number }[];
  struggles: { topic: string; reason: string }[];
  xpThisWeek: number;
  streak: number;
}

export const parentSummary = defineTask({
  name: 'parentSummary',
  model: 'fast',
  schema: parentSummaryOutput,
  system: `You write a warm weekly summary for a parent about their child's learning, in plain words (no jargon, no grades talk).
Refer to the child as "your child". ${JSON_RULES}
Schema: {"highlights":string[] (2-3),"struggles":string[] (0-2, kind wording),"howToHelp":string (one 10-minute activity),"suggestedFamilyMission":string}`,
  user: (i: ParentSummaryInput) => `Language: ${lang(i.locale)}. Week data: ${JSON.stringify({ ...i, locale: undefined })}`,
  mock: (i: ParentSummaryInput) => {
    if (i.locale === 'ar') {
      return {
        highlights: [
          i.validated.length ? `أنجز طفلك ${i.validated.length} مهمّات هذا الأسبوع، منها «${i.validated[0].title}».` : 'بدأ طفلك مهمّة جديدة هذا الأسبوع.',
          `حافظ على سلسلة نشاط لمدة ${i.streak} أيام وجمع ${i.xpThisWeek} نقطة خبرة.`,
          'استخدم الرياضيات لقياس أشياء حقيقية في محيطه — وهذا هو الهدف!',
        ],
        struggles: i.struggles.length ? ['يحتاج أحياناً إلى وقت إضافي لشرح طريقته بالكلمات.'] : [],
        howToHelp: 'خلال 10 دقائق: اطلبوا منه أن يشرح لكم كيف قاس ارتفاع المبنى بالظلال، واسألوه «لماذا تنجح هذه الطريقة؟».',
        suggestedFamilyMission: 'بلّطوا الشرفة معاً على الورق: قيسوا الطول والعرض واحسبوا عدد البلاطات اللازمة.',
      };
    }
    return {
      highlights: [
        i.validated.length ? `Your child completed ${i.validated.length} mission(s) this week, including "${i.validated[0].title}".` : 'Your child started a new mission this week.',
        `They kept a ${i.streak}-day learning streak and earned ${i.xpThisWeek} XP.`,
        'They used math to measure real things around them — exactly the goal!',
      ],
      struggles: i.struggles.length ? ['Sometimes needs extra time to explain their method in words.'] : [],
      howToHelp: 'In 10 minutes: ask them to explain how they measured the building with shadows, then ask "why does that work?".',
      suggestedFamilyMission: 'Tile the balcony together on paper: measure length and width and work out how many tiles you need.',
    };
  },
});
