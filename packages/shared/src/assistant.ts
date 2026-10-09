import { z } from 'zod';

/**
 * Ask Arzino — the director's assistant. The AI only chooses INTENTS (with tokens such as T3 / E1 for people and
 * emails, and day words such as "tomorrow"); the server resolves every name, number and date from real data into a
 * PENDING action card that the director confirms. See DECISIONS.md "Ask Arzino".
 */

export const ASSISTANT_ACTION_KINDS = [
  'announce',
  'report_absence',
  'build_timetable',
  'add_rule',
  'invite_teacher',
  'approve_members',
  'insight',
  'nudge_families',
  'send_digests',
] as const;
export type AssistantActionKind = (typeof ASSISTANT_ACTION_KINDS)[number];

export const INSIGHT_METRICS = ['STRUGGLING_CLASSES', 'STUCK_STUDENTS', 'PARENT_PARTICIPATION', 'ENGAGEMENT', 'PENDING_MEMBERS', 'COVERAGE_GAPS', 'TODAY'] as const;
export type InsightMetric = (typeof INSIGHT_METRICS)[number];

export const ANNOUNCEMENT_AUDIENCES = ['SCHOOL', 'STUDENTS', 'TEACHERS', 'PARENTS', 'GRADE', 'SECTION'] as const;
export type AnnouncementAudienceKey = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const ABSENCE_REASONS = ['SICK', 'TRAINING', 'PERSONAL', 'TRIP', 'OTHER'] as const;
export type AbsenceReasonKey = (typeof ABSENCE_REASONS)[number];

/** when: a day word or an ISO date; resolved with resolveSchoolDay() (school-time.ts) */
export const ASSISTANT_WHEN = ['today', 'tomorrow', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const when = z.union([z.enum(ASSISTANT_WHEN), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);

export const assistantIntent = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('announce'),
    audience: z.enum(ANNOUNCEMENT_AUDIENCES),
    grade: z.number().int().min(1).max(12).optional(),
    section: z.string().max(4).optional(),
    includeParents: z.boolean().optional(),
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(600),
  }),
  z.object({
    kind: z.literal('report_absence'),
    /** teacher token, e.g. "T3" (or "T?1" when the name was ambiguous) */
    teacher: z.string().min(1).max(8),
    when: when.optional(),
    /** 1-based periods; omitted = the whole day */
    periods: z.array(z.number().int().min(1).max(10)).max(10).optional(),
    reason: z.enum(ABSENCE_REASONS).optional(),
  }),
  z.object({ kind: z.literal('build_timetable'), note: z.string().max(200).optional() }),
  z.object({ kind: z.literal('add_rule'), text: z.string().min(3).max(300) }),
  z.object({
    kind: z.literal('invite_teacher'),
    /** email token, e.g. "E1" */
    email: z.string().min(1).max(8),
    /** subject keys from the catalog */
    subjects: z.array(z.string().max(40)).max(5).default([]),
  }),
  z.object({ kind: z.literal('approve_members') }),
  z.object({ kind: z.literal('insight'), metric: z.enum(INSIGHT_METRICS) }),
  z.object({ kind: z.literal('nudge_families'), grade: z.number().int().min(1).max(12).optional() }),
  z.object({ kind: z.literal('send_digests'), grade: z.number().int().min(1).max(12).optional() }),
]);
export type AssistantIntent = z.infer<typeof assistantIntent>;

export const assistantTurnOutput = z.object({
  /** one or two warm sentences in the user's language, no digits (cards carry the real numbers) */
  reply: z.string().min(1).max(400),
  intents: z.array(assistantIntent).max(3).default([]),
  suggestions: z.array(z.string().min(1).max(80)).max(3).default([]),
});
export type AssistantTurnOutput = z.infer<typeof assistantTurnOutput>;

export const assistantMessageBody = z.object({
  text: z.string().trim().min(1).max(1000),
  voice: z.boolean().optional(),
});

/** Edits the director may make on a card before confirming, per kind (validated before execution). */
export const ASSISTANT_EDITS = {
  announce: z
    .object({
      title: z.string().trim().min(1).max(80),
      body: z.string().trim().min(1).max(600),
      audience: z.enum(ANNOUNCEMENT_AUDIENCES),
      grade: z.number().int().min(1).max(12).nullable(),
      section: z.string().max(4).nullable(),
      includeParents: z.boolean(),
    })
    .partial(),
  report_absence: z
    .object({
      reason: z.enum(ABSENCE_REASONS),
      /** substitute per 1-based period; null = supervised study */
      choices: z.array(z.object({ period: z.number().int().min(1).max(10), substituteId: z.string().nullable() })).max(10),
    })
    .partial(),
  build_timetable: z.object({}).partial(),
  add_rule: z.object({ hard: z.boolean() }).partial(),
  invite_teacher: z.object({ subjectIds: z.array(z.string()).min(1).max(10) }).partial(),
  approve_members: z.object({ membershipIds: z.array(z.string()).max(50) }).partial(),
  insight: z.object({}).partial(),
  nudge_families: z.object({ grade: z.number().int().min(1).max(12).nullable() }).partial(),
  send_digests: z.object({ grade: z.number().int().min(1).max(12).nullable() }).partial(),
} satisfies Record<AssistantActionKind, z.ZodType>;

export const confirmActionBody = z.object({ edits: z.record(z.string(), z.unknown()).optional() });
