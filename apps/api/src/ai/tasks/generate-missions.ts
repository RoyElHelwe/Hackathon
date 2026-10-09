import { generateMissionsOutput } from '@tajriba/shared';
import { defineTask, JSON_RULES, lang } from '../task';
import { mockMissions } from './mock-bank';

export interface GenerateMissionsInput {
  topicKey: string;
  topicName: string;
  subject: string;
  grade: number;
  locale: string;
  city: string;
  interests?: string;
  count: number;
  audience?: string;
}

/** Real-life, safe mission rules shared by generateMissions and gamifyLesson. */
export const MISSION_RULES = `You design real-life learning missions for middle-school students in Lebanon (school of 2036: learn by living).
Each mission turns a curriculum topic into something the student does in their real life (home, building, street with an adult, school yard, kitchen),
then proves with photos, a few measured numbers and an explanation. Missions must be SAFE: no heights or climbing, no fire, no sharp tools without an adult,
no chemicals beyond kitchen-safe, never going out alone or at night, never contacting strangers, never sharing location.
Write every text the student reads (title, story, steps, mini lesson, photo hint, field labels, safety notes) speaking directly TO the student as "you" — never "the student".`;

/** JSON shape of one mission item (generateMissionsOutput / gamifyLessonOutput). */
export const MISSION_ITEM_SCHEMA = `{"title":string,"story":string (the real-life hook, 1-3 sentences),"steps":string[] (3-6 short steps),
"miniLesson":{"text":string (<=120 words),"visualSpec":{"caption":string,"shapes":[{"kind":"line","x1","y1","x2","y2","label"?,"dashed"?}|{"kind":"rect","x","y","w","h","label"?}|{"kind":"circle","cx","cy","r","label"?}|{"kind":"polygon","points":[[x,y],...]}|{"kind":"text","x","y","text"}] (coordinates 0-100, color one of violet,mint,sunny,coral,sky,ink)}},
"proofSpec":{"photos":0-3,"photoHint":string,"explanation":true,"fields":[{"key":string,"label":string,"unit"?:string}]},
"rubric":[{"criterion":string,"description":string,"weight":number}] (3 items, weights sum to 100),
"safetyNotes":string,"difficulty":"EASY"|"MEDIUM"|"HARD","estimatedMin":number}`;

const MISSION_SCHEMA = `Schema: {"missions":[${MISSION_ITEM_SCHEMA}]}`;

export const generateMissions = defineTask({
  name: 'generateMissions',
  model: 'fast',
  schema: generateMissionsOutput,
  system: `${MISSION_RULES}
${JSON_RULES}
${MISSION_SCHEMA}`,
  user: (i: GenerateMissionsInput) =>
    `Create ${i.count} different missions.
Subject: ${i.subject}. Topic: ${i.topicName} (${i.topicKey}). Grade: ${i.grade}. City: ${i.city}, Lebanon.
${i.audience === 'FAMILY' ? 'These are FAMILY missions: the student does them together with a parent.' : ''}
${i.interests ? `Student interests: ${i.interests}.` : ''}
Write all text in ${lang(i.locale)}.`,
  mock: (i: GenerateMissionsInput) => ({ missions: mockMissions(i.topicKey, i.topicName, i.count) }),
});
