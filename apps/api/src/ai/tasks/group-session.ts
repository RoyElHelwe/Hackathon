import { groupSessionOutput } from '@tajriba/shared';
import { defineTask, JSON_RULES, lang } from '../task';

export interface GroupSessionInput {
  locale: string;
  stuck: { studentId: string; topic: string; reasons: string[] }[];
}

export const groupSession = defineTask({
  name: 'groupSession',
  model: 'fast',
  schema: groupSessionOutput,
  system: `You help a teacher plan short (15-minute) small-group sessions for students stuck on the same topic.
Students are anonymous ids. Group by topic. Each plan has exactly 3 concrete steps. ${JSON_RULES}
Schema: {"groups":[{"topic":string,"studentIds":string[],"plan":[string,string,string]}]}`,
  user: (i: GroupSessionInput) => `Language: ${lang(i.locale)}. Stuck students: ${JSON.stringify(i.stuck)}`,
  mock: (i: GroupSessionInput) => {
    const byTopic = new Map<string, string[]>();
    for (const s of i.stuck) byTopic.set(s.topic, [...(byTopic.get(s.topic) ?? []), s.studentId]);
    return {
      groups: [...byTopic.entries()].map(([topic, studentIds]) => ({
        topic,
        studentIds,
        plan: [
          `Warm-up (3 min): show a real photo related to ${topic} and ask what they notice.`,
          `Hands-on (8 min): measure a real object together in the classroom and apply the key idea of ${topic} step by step.`,
          'Check (4 min): each student explains the method to a partner, then retries their mission with one hint.',
        ],
      })),
    };
  },
});
