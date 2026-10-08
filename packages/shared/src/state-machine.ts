import type { MissionAudience, SubmissionStatus } from './enums';
import { AI_RETRY_BELOW, FAIRNESS_GAP, PEER_PASS_SCORE, TEACHER_PASS_SCORE } from './gamification';

export type SubmissionEvent =
  | { type: 'SUBMIT' }
  | { type: 'AI_DONE' }
  | { type: 'AI_LOW' }
  | { type: 'FOLLOW_UP' }
  | { type: 'ROUTE' }
  | { type: 'PARENT_CONFIRM' }
  | { type: 'PEER_DONE'; peerScore: number }
  | { type: 'PEER_TIMEOUT' }
  | { type: 'TEACHER_SCORE'; score: number }
  | { type: 'RESTART' };

export interface TransitionContext {
  aiScore?: number | null;
  audience?: MissionAudience;
  flags?: string[];
  peerAvailable?: boolean;
  wallet?: number;
  /** true when the peer review has already been reassigned once */
  alreadyReassigned?: boolean;
  hasProof?: boolean;
}

export type Effect =
  | 'SPEND_POINT'
  | 'REFUND_POINT'
  | 'ASSIGN_PEER'
  | 'REASSIGN_PEER'
  | 'VALIDATE'
  | 'INCREMENT_ATTEMPT'
  | 'FAIRNESS_FLAG';

export interface TransitionResult {
  state: SubmissionStatus;
  effects: Effect[];
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: SubmissionStatus,
    public readonly event: SubmissionEvent['type'],
    reason?: string,
  ) {
    super(`Cannot apply ${event} in state ${from}${reason ? `: ${reason}` : ''}`);
  }
}

const ok = (state: SubmissionStatus, ...effects: Effect[]): TransitionResult => ({ state, effects });

/** Pure submission state machine (CLAUDE.md §6). Throws InvalidTransitionError on illegal moves. */
export function transition(
  state: SubmissionStatus,
  event: SubmissionEvent,
  ctx: TransitionContext = {},
): TransitionResult {
  const fail = (reason?: string): never => {
    throw new InvalidTransitionError(state, event.type, reason);
  };

  // A teacher score is allowed at any time after submission (override).
  if (event.type === 'TEACHER_SCORE') {
    if (state === 'IN_PROGRESS') fail('nothing submitted yet');
    if (event.score < 0 || event.score > 100) fail('score out of range');
    const effects: Effect[] = state === 'PEER_REVIEW' ? ['REFUND_POINT'] : [];
    if (event.score >= TEACHER_PASS_SCORE) {
      return state === 'VALIDATED' ? ok('VALIDATED') : ok('VALIDATED', ...effects, 'VALIDATE');
    }
    return ok('RETRY', ...effects);
  }

  switch (state) {
    case 'IN_PROGRESS':
      if (event.type === 'SUBMIT') {
        if (ctx.hasProof === false) fail('proof required');
        return ok('SUBMITTED');
      }
      break;
    case 'SUBMITTED':
      if (event.type === 'AI_DONE') return ok('AI_CHECKED');
      break;
    case 'AI_CHECKED':
      if (event.type === 'AI_LOW') {
        if ((ctx.aiScore ?? 0) >= AI_RETRY_BELOW) fail('score is high enough');
        return ok('RETRY');
      }
      if (event.type === 'FOLLOW_UP') {
        if ((ctx.aiScore ?? 0) < AI_RETRY_BELOW) fail('score too low, retry needed');
        return ok('FOLLOW_UP_ANSWERED');
      }
      break;
    case 'FOLLOW_UP_ANSWERED':
      if (event.type === 'ROUTE') {
        if (ctx.audience === 'FAMILY') return ok('FAMILY_CONFIRM');
        if (ctx.flags?.includes('possible_copy')) return ok('TEACHER_REVIEW');
        if (ctx.peerAvailable && (ctx.wallet ?? 0) >= 1) return ok('PEER_REVIEW', 'SPEND_POINT', 'ASSIGN_PEER');
        return ok('TEACHER_REVIEW');
      }
      break;
    case 'FAMILY_CONFIRM':
      if (event.type === 'PARENT_CONFIRM') return ok('VALIDATED', 'VALIDATE');
      break;
    case 'PEER_REVIEW':
      if (event.type === 'PEER_DONE') {
        const ai = ctx.aiScore ?? event.peerScore;
        if (Math.abs(event.peerScore - ai) > FAIRNESS_GAP) return ok('TEACHER_REVIEW', 'FAIRNESS_FLAG');
        if (event.peerScore >= PEER_PASS_SCORE) return ok('VALIDATED', 'VALIDATE');
        return ok('RETRY');
      }
      if (event.type === 'PEER_TIMEOUT') {
        if (!ctx.alreadyReassigned && ctx.peerAvailable) return ok('PEER_REVIEW', 'REASSIGN_PEER');
        return ok('TEACHER_REVIEW', 'REFUND_POINT');
      }
      break;
    case 'RETRY':
      if (event.type === 'RESTART') return ok('IN_PROGRESS', 'INCREMENT_ATTEMPT');
      break;
    case 'TEACHER_REVIEW':
    case 'VALIDATED':
      break;
  }
  return fail();
}

/** Statuses where the student is waiting on someone else. */
export const WAITING_STATUSES: SubmissionStatus[] = ['PEER_REVIEW', 'FAMILY_CONFIRM', 'TEACHER_REVIEW'];
