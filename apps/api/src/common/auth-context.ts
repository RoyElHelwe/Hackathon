import type { Request } from 'express';
import type { Actor } from '@tajriba/shared';
import type { Membership, School, User } from '../generated/prisma/client';

export type MembershipWithSchool = Membership & { school: School };

export interface AuthContext {
  userId: string;
  user: User;
  memberships: MembershipWithSchool[];
  /** active APPROVED membership, or null during onboarding */
  active: MembershipWithSchool | null;
  /** lazily resolved actor with class/child relations */
  actor?: Actor;
}

export interface RequestWithAuth extends Request {
  auth?: AuthContext;
}

export const SESSION_COOKIE = 'tj_session';

export interface SessionPayload {
  sub: string;
  mid?: string | null;
}

const ROLE_PRIORITY = ['DIRECTOR', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT'];

export function pickActive(memberships: MembershipWithSchool[], preferredId?: string | null): MembershipWithSchool | null {
  const approved = memberships.filter((m) => m.status === 'APPROVED');
  if (preferredId) {
    const m = approved.find((x) => x.id === preferredId);
    if (m) return m;
  }
  return [...approved].sort((a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role))[0] ?? null;
}
