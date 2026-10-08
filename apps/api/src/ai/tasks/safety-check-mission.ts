import { missionText, safetyCheckOutput, safetyPrefilter } from '@tajriba/shared';
import { defineTask, JSON_RULES } from '../task';

export interface SafetyCheckInput {
  mission: Record<string, unknown>;
}

export const safetyCheckMission = defineTask({
  name: 'safetyCheckMission',
  model: 'fast',
  schema: safetyCheckOutput,
  system: `You are a child-safety reviewer for school missions done by 12-14 year olds outside the classroom.
Reject missions involving: heights or climbing; fire or flames; sharp tools without an adult; chemicals beyond kitchen-safe; going out alone or at night;
contacting strangers; sharing location or personal data. If unsafe, propose a saferVersion (one paragraph rewriting the risky part).
${JSON_RULES}
Schema: {"safe":boolean,"issues":string[],"saferVersion"?:string}`,
  user: (i: SafetyCheckInput) => `Mission JSON:\n${JSON.stringify(i.mission)}`,
  mock: (i: SafetyCheckInput) => {
    const issues = safetyPrefilter(missionText(i.mission));
    return issues.length
      ? { safe: false, issues, saferVersion: 'Do this activity on the ground, during the day, with an adult present, using only safe household items.' }
      : { safe: true, issues: [] };
  },
});
