import { z } from 'zod';
import { DIFFICULTIES, LOCALES, MISSION_AUDIENCES, ROLES } from './enums';

export const i18nText = z.object({ en: z.string(), ar: z.string().optional(), fr: z.string().optional() });

// ---------- Shapes rendered by the UI ----------

/** Simple shapes the UI renders as SVG for mini-lessons. Coordinates in a 0..100 viewBox. */
export const visualShape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('line'), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), color: z.string().optional(), dashed: z.boolean().optional(), label: z.string().optional() }),
  z.object({ kind: z.literal('rect'), x: z.number(), y: z.number(), w: z.number(), h: z.number(), color: z.string().optional(), label: z.string().optional() }),
  z.object({ kind: z.literal('circle'), cx: z.number(), cy: z.number(), r: z.number(), color: z.string().optional(), label: z.string().optional() }),
  z.object({ kind: z.literal('polygon'), points: z.array(z.tuple([z.number(), z.number()])).min(3), color: z.string().optional(), label: z.string().optional() }),
  z.object({ kind: z.literal('text'), x: z.number(), y: z.number(), text: z.string(), color: z.string().optional() }),
]);
export type VisualShape = z.infer<typeof visualShape>;
export const visualSpec = z.object({ shapes: z.array(visualShape).max(30), caption: z.string().optional() });
export type VisualSpec = z.infer<typeof visualSpec>;

export const proofField = z.object({ key: z.string(), label: z.string(), unit: z.string().optional() });
export const proofSpec = z.object({
  photos: z.number().int().min(0).max(5),
  photoHint: z.string().optional(),
  explanation: z.boolean(),
  fields: z.array(proofField).max(6),
});
export type ProofSpec = z.infer<typeof proofSpec>;

export const rubricItem = z.object({ criterion: z.string(), description: z.string(), weight: z.number().min(0).max(100) });
export type RubricItem = z.infer<typeof rubricItem>;

// ---------- AI task outputs ----------

export const aiMission = z.object({
  title: z.string().min(3),
  story: z.string().min(10),
  steps: z.array(z.string()).min(1).max(8),
  miniLesson: z.object({ text: z.string(), visualSpec }),
  proofSpec,
  rubric: z.array(rubricItem).min(1).max(6),
  safetyNotes: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  estimatedMin: z.number().int().min(5).max(240),
});
export type AiMission = z.infer<typeof aiMission>;
export const generateMissionsOutput = z.object({ missions: z.array(aiMission).min(1).max(5) });

export const safetyCheckOutput = z.object({
  safe: z.boolean(),
  issues: z.array(z.string()),
  saferVersion: z.string().optional(),
});
export type SafetyCheck = z.infer<typeof safetyCheckOutput>;

export const miniLessonOutput = z.object({ text: z.string(), visualSpec });
export const hintOutput = z.object({ hint: z.string().min(1) });

export const checkSubmissionOutput = z.object({
  score: z.number().int().min(0).max(100),
  correct: z.boolean(),
  perCriterion: z.array(z.object({ criterion: z.string(), score: z.number().min(0).max(100), comment: z.string() })),
  feedback: z.string(),
  followUpQuestion: z.string(),
  flags: z.array(z.string()),
});
export type CheckSubmission = z.infer<typeof checkSubmissionOutput>;

export const checkFollowUpOutput = z.object({
  understood: z.boolean(),
  scoreDelta: z.number().int().min(-10).max(10),
  feedback: z.string(),
});
export type CheckFollowUp = z.infer<typeof checkFollowUpOutput>;

export const peerSheetOutput = z.object({
  checklist: z.array(z.object({ criterion: z.string(), whatToLookFor: z.string() })).min(1),
  questionsToAsk: z.array(z.string()).length(3),
  commonMistakes: z.array(z.string()),
});
export type PeerSheet = z.infer<typeof peerSheetOutput>;

export const parentSummaryOutput = z.object({
  highlights: z.array(z.string()),
  struggles: z.array(z.string()),
  howToHelp: z.string(),
  suggestedFamilyMission: z.string(),
});
export type ParentSummaryContent = z.infer<typeof parentSummaryOutput>;

export const groupSessionOutput = z.object({
  groups: z.array(z.object({ topic: z.string(), studentIds: z.array(z.string()), plan: z.array(z.string()).length(3) })),
});
export type GroupSessions = z.infer<typeof groupSessionOutput>;

// ---------- API request bodies ----------

export const createSchoolBody = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  gradeLevels: z.array(z.number().int().min(1).max(12)).default([]),
});
export const joinSchoolBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}-\d{4}$/),
  role: z.enum(['TEACHER', 'STUDENT']).default('TEACHER'),
  subjectIds: z.array(z.string()).max(20).optional(),
});
export const activeRoleBody = z.object({ membershipId: z.string() });
export const createInviteBody = z.object({
  email: z.email(),
  role: z.enum(ROLES),
  studentId: z.string().optional(),
  subjectIds: z.array(z.string()).max(20).optional(),
});
export const SUBJECT_COLORS = ['violet', 'sky', 'mint', 'green', 'coral', 'sunny', 'pink', 'slate'] as const;
export const SUBJECT_ICONS = ['triangle', 'zap', 'flask', 'leaf', 'landmark', 'languages', 'book', 'globe', 'music', 'palette', 'cpu', 'dumbbell'] as const;
export const createSubjectBody = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(SUBJECT_COLORS).optional(),
  icon: z.enum(SUBJECT_ICONS).optional(),
});
export const updateSubjectBody = createSubjectBody.partial();
export const setTeacherSubjectsBody = z.object({ subjectIds: z.array(z.string()).min(1).max(20) });
export const importItem = z.object({
  courseId: z.string().min(1),
  subjectId: z.string().min(1),
  gradeLevel: z.number().int().min(1).max(12),
  sectionLabel: z.string().trim().max(20).nullish(),
});
/** `items` (preferred) carries the teacher's subject + grade per Classroom course; legacy `courseIds` uses the AI suggestions. */
export const importClassesBody = z
  .object({
    courseIds: z.array(z.string().min(1)).max(100).optional(),
    items: z.array(importItem).max(100).optional(),
  })
  .refine((b) => (b.items?.length ?? 0) + (b.courseIds?.length ?? 0) > 0, { message: 'Select at least one course.' });
export type ImportClassesBody = z.infer<typeof importClassesBody>;
export const setClassCourseBody = z.object({
  subjectId: z.string().min(1),
  gradeLevel: z.number().int().min(1).max(12),
  sectionLabel: z.string().trim().max(20).nullish(),
});
export type SetClassCourseBody = z.infer<typeof setClassCourseBody>;
export const classSettingsBody = z.object({
  leaderboardEnabled: z.boolean().optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
});
export const generateMissionsBody = z.object({
  topicId: z.string(),
  classId: z.string(),
  count: z.number().int().min(1).max(5).default(3),
  interests: z.string().max(200).optional(),
  audience: z.enum(MISSION_AUDIENCES).optional(),
});
export const updateMissionBody = z.object({
  title: i18nText.optional(),
  story: i18nText.optional(),
  steps: z.array(z.string()).optional(),
  safetyNotes: i18nText.optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  estimatedMin: z.number().int().min(5).max(240).optional(),
  audience: z.enum(MISSION_AUDIENCES).optional(),
});
export const approveMissionBody = z.object({
  postToClassroom: z.boolean().default(false),
  dueAt: z.iso.datetime().optional().nullable(),
  useSaferVersion: z.boolean().optional(),
});
export const startSubmissionBody = z.object({ missionId: z.string() });
export const submitBody = z.object({
  photoUploadIds: z.array(z.string()).max(5).default([]),
  audioUploadId: z.string().optional().nullable(),
  explanation: z.string().max(4000).optional().nullable(),
  answers: z.record(z.string(), z.union([z.number(), z.string()])).optional().nullable(),
});
export const followUpBody = z.object({ answer: z.string().trim().min(1).max(2000) });
export const hintBody = z.object({ partialWork: z.string().max(2000).optional() });
export const completePeerReviewBody = z.object({
  checklist: z.array(z.object({ criterion: z.string(), ok: z.boolean() })),
  score: z.number().int().min(0).max(100),
  comment: z.string().max(1000).optional(),
});
export const rateReviewBody = z.object({ helpfulRating: z.number().int().min(1).max(5) });
export const teacherReviewBody = z.object({ score: z.number().int().min(0).max(100), comment: z.string().max(1000).optional() });
export const familyLinkBody = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
export const familyConfirmBody = z.object({ note: z.string().max(500).optional() });
export const messageBody = z.object({ toId: z.string(), studentId: z.string().optional(), body: z.string().trim().min(1).max(2000) });
export const schoolSettingsBody = z.object({
  leaderboardPolicy: z.enum(['TEACHER_CHOICE', 'ALWAYS_OFF']).optional(),
  safetyRules: z.array(z.string()).optional(),
  defaultLocale: z.enum(LOCALES).optional(),
});
export const walletGrantBody = z.object({ studentId: z.string(), points: z.number().int().min(1).max(10) });
