import type { MissionAudience, Role } from './enums';
import { MAX_OPEN_REVIEWS } from './gamification';

export const ACTIONS = ['read', 'write', 'review', 'override', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  'school',
  'members',
  'class',
  'mission_draft',
  'mission',
  'submission',
  'progress',
  'peer_evaluation',
  'parent_summary',
  'upload',
  'family',
  'message',
  'notification',
  'self',
] as const;
export type Resource = (typeof RESOURCES)[number];

/** Who the request comes from, with the relations needed for object-level checks. */
export interface Actor {
  userId: string;
  role: Role;
  schoolId: string;
  classIdsTaught?: string[];
  classIdsEnrolled?: string[];
  childIds?: string[];
  childClassIds?: string[];
}

/** Facts about the object being accessed. Only the relevant fields need to be set. */
export interface Target {
  schoolId?: string;
  classId?: string | null;
  /** student who owns the object (submission, progress, upload) */
  ownerId?: string;
  /** class ids the owning student is enrolled in (progress) */
  ownerClassIds?: string[];
  evaluatorId?: string;
  /** current user is an assigned peer evaluator for this object */
  assignedToActor?: boolean;
  audience?: MissionAudience;
  membershipUserId?: string;
}

/**
 * Coarse role table: can this role EVER perform this action on this resource?
 * Used by the API PolicyGuard before any object is loaded. Default deny.
 */
const ROLE_TABLE: Record<Role, Partial<Record<Resource, Action[]>>> = {
  DIRECTOR: {
    school: ['read', 'write', 'delete'],
    members: ['read', 'write'],
    class: ['read', 'write'],
    mission_draft: ['read'],
    mission: ['read'],
    submission: ['read'],
    progress: ['read'],
    peer_evaluation: ['read'],
    upload: ['read'],
    message: ['read', 'write'],
    notification: ['read', 'write'],
    self: ['read', 'write'],
  },
  ADMIN: {
    school: ['read', 'write'],
    members: ['read', 'write'],
    class: ['read', 'write'],
    mission_draft: ['read'],
    mission: ['read'],
    submission: ['read'],
    progress: ['read'],
    peer_evaluation: ['read'],
    upload: ['read'],
    message: ['read', 'write'],
    notification: ['read', 'write'],
    self: ['read', 'write'],
  },
  TEACHER: {
    school: ['read'],
    members: ['read'],
    class: ['read', 'write'],
    mission_draft: ['read', 'write'],
    mission: ['read', 'write'],
    submission: ['read', 'review', 'override'],
    progress: ['read'],
    peer_evaluation: ['read', 'override'],
    upload: ['read', 'write'],
    family: ['write'],
    message: ['read', 'write'],
    notification: ['read', 'write'],
    self: ['read', 'write'],
  },
  STUDENT: {
    class: ['read'],
    mission: ['read'],
    submission: ['read', 'write'],
    progress: ['read'],
    peer_evaluation: ['read', 'write'],
    upload: ['read', 'write'],
    family: ['write'],
    notification: ['read', 'write'],
    self: ['read', 'write'],
  },
  PARENT: {
    class: ['read'],
    mission: ['read'],
    submission: ['read'],
    progress: ['read'],
    parent_summary: ['read', 'write'],
    upload: ['read'],
    family: ['read', 'write'],
    message: ['read', 'write'],
    notification: ['read', 'write'],
    self: ['read', 'write'],
  },
};

export function roleMayEver(role: Role, action: Action, resource: Resource): boolean {
  return ROLE_TABLE[role]?.[resource]?.includes(action) ?? false;
}

const has = (list: string[] | undefined, id: string | null | undefined) => !!id && !!list?.includes(id);
const intersects = (a: string[] | undefined, b: string[] | undefined) => !!a && !!b && a.some((x) => b.includes(x));

/** Object-level permission check (CLAUDE.md §4). Default deny. */
export function can(actor: Actor, action: Action, resource: Resource, target: Target = {}): boolean {
  if (!roleMayEver(actor.role, action, resource)) return false;
  if (target.schoolId && target.schoolId !== actor.schoolId) return false;

  const isAdmin = actor.role === 'DIRECTOR' || actor.role === 'ADMIN';
  const teaches = has(actor.classIdsTaught, target.classId);
  const enrolled = has(actor.classIdsEnrolled, target.classId);
  const own = !!target.ownerId && target.ownerId === actor.userId;
  const child = has(actor.childIds, target.ownerId);

  switch (resource) {
    case 'school':
    case 'members':
      if (isAdmin) return true;
      // teachers can read their own membership only
      return actor.role === 'TEACHER' && action === 'read' && target.membershipUserId === actor.userId;

    case 'class':
      if (isAdmin) return true;
      if (actor.role === 'TEACHER') return teaches;
      if (actor.role === 'STUDENT') return action === 'read' && enrolled;
      if (actor.role === 'PARENT') return action === 'read' && has(actor.childClassIds, target.classId);
      return false;

    case 'mission_draft':
      if (isAdmin) return action === 'read';
      if (actor.role === 'TEACHER') return target.classId == null ? action === 'read' : teaches;
      return false;

    case 'mission':
      if (isAdmin) return action === 'read';
      if (actor.role === 'TEACHER') return target.classId == null ? action === 'read' : teaches;
      if (actor.role === 'STUDENT') return action === 'read' && enrolled;
      if (actor.role === 'PARENT')
        return action === 'read' && target.audience === 'FAMILY' && has(actor.childClassIds, target.classId);
      return false;

    case 'submission':
      if (isAdmin) return action === 'read';
      if (actor.role === 'TEACHER') return teaches;
      if (actor.role === 'STUDENT') return own || (action === 'read' && !!target.assignedToActor);
      if (actor.role === 'PARENT') return action === 'read' && child;
      return false;

    case 'progress':
      if (isAdmin) return action === 'read';
      if (actor.role === 'TEACHER') return intersects(actor.classIdsTaught, target.ownerClassIds);
      if (actor.role === 'STUDENT') return own;
      if (actor.role === 'PARENT') return child;
      return false;

    case 'peer_evaluation':
      if (isAdmin) return action === 'read';
      if (actor.role === 'TEACHER') return teaches;
      if (actor.role === 'STUDENT') return !!target.evaluatorId && target.evaluatorId === actor.userId;
      return false;

    case 'parent_summary':
      return actor.role === 'PARENT' && child;

    case 'upload':
      if (isAdmin) return true;
      if (actor.role === 'TEACHER') return teaches || own;
      if (actor.role === 'STUDENT') return own || !!target.assignedToActor;
      if (actor.role === 'PARENT') return child;
      return false;

    case 'family':
    case 'message':
    case 'notification':
    case 'self':
      return true;
  }
  return false;
}

// ---------- Peer assignment ----------

export interface EvaluatorCandidate {
  userId: string;
  sameClass: boolean;
  enrollmentActive: boolean;
  topicMastered: boolean;
  openReviews: number;
  lastAssignedAt: Date | null;
}

export function isEligibleEvaluator(c: EvaluatorCandidate, submitterId: string): boolean {
  return (
    c.userId !== submitterId &&
    c.sameClass &&
    c.enrollmentActive &&
    c.topicMastered &&
    c.openReviews < MAX_OPEN_REVIEWS
  );
}

/** Fewest open reviews wins; tie-break by least recently assigned (never assigned first). */
export function pickEvaluator(
  candidates: EvaluatorCandidate[],
  submitterId: string,
  exclude: string[] = [],
): EvaluatorCandidate | null {
  const eligible = candidates.filter((c) => isEligibleEvaluator(c, submitterId) && !exclude.includes(c.userId));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    if (a.openReviews !== b.openReviews) return a.openReviews - b.openReviews;
    const at = a.lastAssignedAt?.getTime() ?? 0;
    const bt = b.lastAssignedAt?.getTime() ?? 0;
    if (at !== bt) return at - bt;
    return a.userId.localeCompare(b.userId);
  });
  return eligible[0];
}

// ---------- Codes ----------

/** School code: 3 letters from the city + 4 digits, e.g. TRP-4821. */
export function makeSchoolCode(city: string, random: () => number = Math.random): string {
  const letters = city
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  const consonants = letters.replace(/[AEIOU]/g, '');
  const base = (letters[0] ?? 'X') + (consonants.slice(1) || letters.slice(1));
  const prefix = (base + 'XXX').slice(0, 3);
  const digits = String(Math.floor(random() * 10_000)).padStart(4, '0');
  return `${prefix}-${digits}`;
}

export function makeFamilyCode(random: () => number = Math.random): string {
  return String(Math.floor(random() * 1_000_000)).padStart(6, '0');
}

export const FAMILY_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export type FamilyCodeCheck = 'ok' | 'not_found' | 'expired' | 'used';

export function checkFamilyCode(
  code: { expiresAt: Date; usedAt: Date | null } | null,
  now: Date = new Date(),
): FamilyCodeCheck {
  if (!code) return 'not_found';
  if (code.usedAt) return 'used';
  if (code.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'ok';
}
