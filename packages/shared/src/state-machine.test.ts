import { InvalidTransitionError, transition } from './state-machine';

describe('submission state machine', () => {
  it('submits from IN_PROGRESS', () => {
    expect(transition('IN_PROGRESS', { type: 'SUBMIT' }).state).toBe('SUBMITTED');
  });

  it('rejects submit without proof', () => {
    expect(() => transition('IN_PROGRESS', { type: 'SUBMIT' }, { hasProof: false })).toThrow(InvalidTransitionError);
  });

  it('AI check moves to AI_CHECKED', () => {
    expect(transition('SUBMITTED', { type: 'AI_DONE' }).state).toBe('AI_CHECKED');
  });

  it('low AI score goes to RETRY', () => {
    expect(transition('AI_CHECKED', { type: 'AI_LOW' }, { aiScore: 40 }).state).toBe('RETRY');
    expect(() => transition('AI_CHECKED', { type: 'AI_LOW' }, { aiScore: 60 })).toThrow();
  });

  it('follow-up answered only when score is high enough', () => {
    expect(transition('AI_CHECKED', { type: 'FOLLOW_UP' }, { aiScore: 80 }).state).toBe('FOLLOW_UP_ANSWERED');
    expect(() => transition('AI_CHECKED', { type: 'FOLLOW_UP' }, { aiScore: 30 })).toThrow();
  });

  describe('routing after follow-up', () => {
    it('family audience → FAMILY_CONFIRM', () => {
      expect(transition('FOLLOW_UP_ANSWERED', { type: 'ROUTE' }, { audience: 'FAMILY', peerAvailable: true, wallet: 3 }).state).toBe('FAMILY_CONFIRM');
    });
    it('possible copy → TEACHER_REVIEW', () => {
      const r = transition('FOLLOW_UP_ANSWERED', { type: 'ROUTE' }, { flags: ['possible_copy'], peerAvailable: true, wallet: 3 });
      expect(r.state).toBe('TEACHER_REVIEW');
      expect(r.effects).not.toContain('SPEND_POINT');
    });
    it('peer available and wallet ≥ 1 → PEER_REVIEW and spends a point', () => {
      const r = transition('FOLLOW_UP_ANSWERED', { type: 'ROUTE' }, { peerAvailable: true, wallet: 1 });
      expect(r.state).toBe('PEER_REVIEW');
      expect(r.effects).toEqual(['SPEND_POINT', 'ASSIGN_PEER']);
    });
    it('empty wallet → TEACHER_REVIEW', () => {
      expect(transition('FOLLOW_UP_ANSWERED', { type: 'ROUTE' }, { peerAvailable: true, wallet: 0 }).state).toBe('TEACHER_REVIEW');
    });
    it('no peer → TEACHER_REVIEW', () => {
      expect(transition('FOLLOW_UP_ANSWERED', { type: 'ROUTE' }, { peerAvailable: false, wallet: 3 }).state).toBe('TEACHER_REVIEW');
    });
  });

  it('parent confirms family mission → VALIDATED', () => {
    const r = transition('FAMILY_CONFIRM', { type: 'PARENT_CONFIRM' });
    expect(r.state).toBe('VALIDATED');
    expect(r.effects).toContain('VALIDATE');
  });

  describe('peer review', () => {
    it('peer ≥ 70 and fair → VALIDATED', () => {
      expect(transition('PEER_REVIEW', { type: 'PEER_DONE', peerScore: 80 }, { aiScore: 85 }).state).toBe('VALIDATED');
    });
    it('peer < 70 and fair → RETRY', () => {
      expect(transition('PEER_REVIEW', { type: 'PEER_DONE', peerScore: 60 }, { aiScore: 65 }).state).toBe('RETRY');
    });
    it('fairness flag when |peer − AI| > 25', () => {
      const r = transition('PEER_REVIEW', { type: 'PEER_DONE', peerScore: 40 }, { aiScore: 90 });
      expect(r.state).toBe('TEACHER_REVIEW');
      expect(r.effects).toContain('FAIRNESS_FLAG');
    });
    it('exactly 25 apart is still fair', () => {
      expect(transition('PEER_REVIEW', { type: 'PEER_DONE', peerScore: 75 }, { aiScore: 100 }).state).toBe('VALIDATED');
    });
    it('timeout reassigns once', () => {
      const r = transition('PEER_REVIEW', { type: 'PEER_TIMEOUT' }, { alreadyReassigned: false, peerAvailable: true });
      expect(r).toEqual({ state: 'PEER_REVIEW', effects: ['REASSIGN_PEER'] });
    });
    it('second timeout → TEACHER_REVIEW with refund', () => {
      const r = transition('PEER_REVIEW', { type: 'PEER_TIMEOUT' }, { alreadyReassigned: true, peerAvailable: true });
      expect(r).toEqual({ state: 'TEACHER_REVIEW', effects: ['REFUND_POINT'] });
    });
    it('timeout with no other peer → TEACHER_REVIEW with refund', () => {
      expect(transition('PEER_REVIEW', { type: 'PEER_TIMEOUT' }, { peerAvailable: false }).effects).toContain('REFUND_POINT');
    });
  });

  describe('teacher review', () => {
    it('score ≥ 70 → VALIDATED', () => {
      expect(transition('TEACHER_REVIEW', { type: 'TEACHER_SCORE', score: 70 }).state).toBe('VALIDATED');
    });
    it('score < 70 → RETRY', () => {
      expect(transition('TEACHER_REVIEW', { type: 'TEACHER_SCORE', score: 69 }).state).toBe('RETRY');
    });
    it('teacher can override during peer review (refunds point)', () => {
      const r = transition('PEER_REVIEW', { type: 'TEACHER_SCORE', score: 90 });
      expect(r.state).toBe('VALIDATED');
      expect(r.effects).toEqual(['REFUND_POINT', 'VALIDATE']);
    });
    it('override of an already validated submission does not re-award', () => {
      expect(transition('VALIDATED', { type: 'TEACHER_SCORE', score: 95 })).toEqual({ state: 'VALIDATED', effects: [] });
    });
    it('cannot score before submission', () => {
      expect(() => transition('IN_PROGRESS', { type: 'TEACHER_SCORE', score: 90 })).toThrow();
    });
  });

  it('retry restarts with attempt + 1', () => {
    expect(transition('RETRY', { type: 'RESTART' })).toEqual({ state: 'IN_PROGRESS', effects: ['INCREMENT_ATTEMPT'] });
  });

  it('rejects illegal transitions', () => {
    expect(() => transition('VALIDATED', { type: 'SUBMIT' })).toThrow(InvalidTransitionError);
    expect(() => transition('IN_PROGRESS', { type: 'AI_DONE' })).toThrow();
    expect(() => transition('FAMILY_CONFIRM', { type: 'PEER_DONE', peerScore: 90 })).toThrow();
  });
});
