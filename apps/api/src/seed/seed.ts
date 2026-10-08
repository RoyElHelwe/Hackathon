import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { BASE_XP, dayKey, Difficulty, I18nText, pickText } from '@tajriba/shared';
import { encrypt } from '../common/crypto';
import { averageHash } from '../uploads/phash';
import type { PrismaClient } from '../generated/prisma/client';
import { BADGES, MISSIONS, SUBJECTS, TOPICS } from './content';
import { illustrationJpeg } from './illustrations';

const DAY = 86400_000;
export const SCHOOL_CODE = 'TRP-2036';

export const SEED_USERS = [
  { handle: 'director', googleId: 'seed-director', email: 'sami@tripoli-future.school', name: 'Sami Haddad', locale: 'en', roles: [['DIRECTOR', 'APPROVED']] },
  { handle: 'rana', googleId: 'seed-rana', email: 'rana@tripoli-future.school', name: 'Rana Khoury', locale: 'en', roles: [['TEACHER', 'APPROVED']] },
  { handle: 'lea', googleId: 'seed-lea', email: 'lea@students.tripoli-future.school', name: 'Lea Saliba', locale: 'en', roles: [['STUDENT', 'APPROVED']] },
  { handle: 'karim', googleId: 'seed-karim', email: 'karim@students.tripoli-future.school', name: 'Karim Hamadeh', locale: 'en', roles: [['STUDENT', 'APPROVED']] },
  { handle: 'omar', googleId: 'seed-omar', email: 'omar@students.tripoli-future.school', name: 'Omar Tannous', locale: 'en', roles: [['STUDENT', 'APPROVED']] },
  { handle: 'mona', googleId: 'seed-mona', email: 'mona.saliba@gmail.example', name: 'Mona Saliba', locale: 'ar', roles: [['PARENT', 'APPROVED']] },
  { handle: 'hassan', googleId: 'seed-hassan', email: 'hassan@tripoli-future.school', name: 'Hassan Merhi', locale: 'en', roles: [['TEACHER', 'APPROVED']] },
  { handle: 'pending_teacher', googleId: 'seed-nadine', email: 'nadine@tripoli-future.school', name: 'Nadine Fakhoury', locale: 'en', roles: [['TEACHER', 'PENDING']] },
] as const;

type Ids = Record<string, string>;

/** Seeded photos live in the DB (`data`), like real uploads: survives ephemeral filesystems. */
async function saveIllustration(prisma: PrismaClient, ownerId: string, schoolId: string, name: string): Promise<string> {
  const buf = await illustrationJpeg(name);
  const rel = path.posix.join(schoolId, 'seed', `${name}-${randomUUID()}.jpg`);
  const up = await prisma.upload.create({
    data: { ownerId, schoolId, kind: 'IMAGE', path: rel, mime: 'image/jpeg', bytes: buf.length, phash: await averageHash(buf), data: new Uint8Array(buf) },
    select: { id: true },
  });
  return up.id;
}

/** Idempotent demo world (CLAUDE.md §13). Static data is upserted; seeded users' activity is reset and recreated. */
export async function seed(prisma: PrismaClient, opts: { quiet?: boolean } = {}) {
  const log = (m: string) => !opts.quiet && console.log(m);
  const now = Date.now();

  // ---------- School ----------
  const schoolSettings = { gradeLevels: [7, 8, 9], leaderboardPolicy: 'TEACHER_CHOICE', defaultLocale: 'en', safetyRules: ['No heights', 'Adult present outdoors'] };
  const school = await prisma.school.upsert({
    where: { schoolCode: SCHOOL_CODE },
    update: { settings: schoolSettings },
    create: { name: 'Tripoli Future School', city: 'Tripoli', schoolCode: SCHOOL_CODE, settings: schoolSettings },
  });

  // ---------- Users ----------
  const users: Ids = {};
  for (const u of SEED_USERS) {
    const row = await prisma.user.upsert({
      where: { googleId: u.googleId },
      update: { devHandle: u.handle, name: u.name, locale: u.locale, status: 'ACTIVE' },
      create: { googleId: u.googleId, email: u.email, name: u.name, locale: u.locale, devHandle: u.handle, status: 'ACTIVE' },
    });
    users[u.handle] = row.id;
    for (const [role, status] of u.roles) {
      await prisma.membership.upsert({
        where: { userId_schoolId_role: { userId: row.id, schoolId: school.id, role } },
        update: { status },
        create: { userId: row.id, schoolId: school.id, role, status },
      });
    }
  }
  await prisma.user.update({ where: { id: users.rana }, data: { googleRefreshToken: encrypt('fake-refresh-token') } });
  const studentIds = [users.lea, users.karim, users.omar];

  // ---------- Reset seeded activity (idempotency) ----------
  const seededIds = Object.values(users);
  await prisma.peerEvaluation.deleteMany({ where: { OR: [{ evaluatorId: { in: seededIds } }, { submission: { studentId: { in: seededIds } } }] } });
  await prisma.submission.deleteMany({ where: { studentId: { in: seededIds } } });
  await prisma.xpEvent.deleteMany({ where: { studentId: { in: seededIds } } });
  await prisma.walletTx.deleteMany({ where: { studentId: { in: seededIds } } });
  await prisma.wallet.deleteMany({ where: { studentId: { in: seededIds } } });
  await prisma.streak.deleteMany({ where: { studentId: { in: seededIds } } });
  await prisma.studentBadge.deleteMany({ where: { studentId: { in: seededIds } } });
  await prisma.topicProgress.deleteMany({ where: { studentId: { in: seededIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: seededIds } } });
  await prisma.familyCode.deleteMany({ where: { studentId: { in: seededIds } } });
  await prisma.message.deleteMany({ where: { OR: [{ fromId: { in: seededIds } }, { toId: { in: seededIds } }] } });
  await prisma.parentSummary.deleteMany({ where: { parentId: { in: seededIds } } });
  await prisma.upload.deleteMany({ where: { ownerId: { in: seededIds } } });

  // ---------- Content ----------
  const subjects: Ids = {};
  for (const s of SUBJECTS) {
    const row = await prisma.subject.upsert({
      where: { key: s.key },
      update: { name: s.name, color: s.color, icon: s.icon, schoolId: school.id },
      create: { ...s, schoolId: school.id },
    });
    subjects[s.key] = row.id;
  }
  // Reset the seeded teachers' subjects so a re-seed restores exactly Math.
  await prisma.teacherSubject.deleteMany({ where: { schoolId: school.id, teacherId: { in: seededIds } } });
  for (const handle of ['rana', 'hassan'] as const) {
    await prisma.teacherSubject.upsert({
      where: { teacherId_subjectId: { teacherId: users[handle], subjectId: subjects.math } },
      update: {},
      create: { teacherId: users[handle], schoolId: school.id, subjectId: subjects.math },
    });
  }
  const topics: Ids = {};
  for (const t of TOPICS) {
    const data = { subjectId: subjects[t.subject], name: t.name, description: t.description, icon: t.icon, gradeLevel: 8, curriculumRef: t.ref, posX: t.pos[0], posY: t.pos[1] };
    const row = await prisma.topic.upsert({ where: { key: t.key }, update: data, create: { key: t.key, ...data } });
    topics[t.key] = row.id;
  }
  for (const t of TOPICS) {
    for (const p of t.prereqs) {
      await prisma.topicPrerequisite.upsert({
        where: { topicId_prerequisiteId: { topicId: topics[t.key], prerequisiteId: topics[p] } },
        update: {},
        create: { topicId: topics[t.key], prerequisiteId: topics[p] },
      });
    }
  }
  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { key: b.key }, update: { name: b.name, icon: b.icon, criteria: { text: b.criteria } }, create: { key: b.key, name: b.name, icon: b.icon, criteria: { text: b.criteria } } });
  }

  // ---------- Class ----------
  const cls = await prisma.class.upsert({
    where: { classroomCourseId: 'fake-8b-math' },
    update: { syncError: null, lastSyncedAt: new Date(now - 5 * 60_000), settings: { leaderboardEnabled: false }, subjectId: subjects.math },
    create: { schoolId: school.id, name: '8B Math', gradeLevel: 8, classroomCourseId: 'fake-8b-math', settings: { leaderboardEnabled: false }, lastSyncedAt: new Date(now - 5 * 60_000), subjectId: subjects.math },
  });
  await prisma.classTeacher.upsert({
    where: { classId_teacherId: { classId: cls.id, teacherId: users.rana } },
    update: { type: 'OWNER' },
    create: { classId: cls.id, teacherId: users.rana, type: 'OWNER' },
  });
  for (const sid of studentIds) {
    await prisma.enrollment.upsert({ where: { classId_studentId: { classId: cls.id, studentId: sid } }, update: { status: 'ACTIVE' }, create: { classId: cls.id, studentId: sid } });
  }

  // ---------- Missions ----------
  // Remove missions created while rehearsing (AI drafts etc.) so every reset starts from the same demo state.
  await prisma.mission.deleteMany({ where: { classId: cls.id, key: null } });
  const missions: Record<string, { id: string; difficulty: Difficulty; topic: string; title: I18nText }> = {};
  for (const m of MISSIONS) {
    const { key, topic, audience, ...content } = m;
    const data = {
      ...content,
      proofSpec: content.proofSpec as object,
      topicId: topics[topic],
      classId: cls.id,
      createdById: users.rana,
      status: 'APPROVED' as const,
      audience,
      xpReward: BASE_XP[content.difficulty],
      safetyCheck: { safe: true, issues: [], checkedAt: new Date(now - 10 * DAY).toISOString() },
      classroomCourseWorkId: 'classroomCourseWorkId' in m ? m.classroomCourseWorkId : null,
    };
    const row = await prisma.mission.upsert({ where: { key }, update: data, create: { key, ...data } });
    missions[key] = { id: row.id, difficulty: content.difficulty, topic, title: content.title };
  }

  // ---------- Activity ----------
  const xp = async (studentId: string, amount: number, reason: string, at: number, subject = 'math', refId?: string) =>
    prisma.xpEvent.create({ data: { studentId, amount, reason, subjectId: subjects[subject], refId, createdAt: new Date(at) } });

  async function validated(studentId: string, key: string, at: number, score: number, photo: string, opts2: { explanation: string; answers?: Record<string, number>; attempt?: number; subject?: string } ) {
    const m = missions[key];
    const photoId = await saveIllustration(prisma, studentId, school.id, photo);
    const sub = await prisma.submission.create({
      data: {
        missionId: m.id,
        studentId,
        status: 'VALIDATED',
        attempt: opts2.attempt ?? 1,
        photoUploadIds: [photoId],
        explanation: opts2.explanation,
        answers: opts2.answers ?? {},
        aiCheck: { score, correct: true, perCriterion: [], feedback: 'Great job!', followUpQuestion: 'Why does your method work?', flags: [] },
        followUpAnswer: 'Because the ratios stay the same when the shape is the same.',
        aiFollowUpCheck: { understood: true, scoreDelta: 5, feedback: 'Exactly!' },
        finalScore: score,
        gradeSynced: true,
        startedAt: new Date(at - DAY / 2),
        submittedAt: new Date(at - DAY / 3),
        validatedAt: new Date(at),
      },
    });
    await xp(studentId, BASE_XP[m.difficulty], 'MISSION_VALIDATED', at, opts2.subject, sub.id);
    if ((opts2.attempt ?? 1) === 1) await xp(studentId, 10, 'FIRST_TRY', at, opts2.subject, sub.id);
    await xp(studentId, 10, 'FOLLOW_UP', at, opts2.subject, sub.id);
    await prisma.topicProgress.upsert({
      where: { studentId_topicId: { studentId, topicId: topics[m.topic] } },
      update: { state: 'MASTERED', bestScore: score, masteredAt: new Date(at) },
      create: { studentId, topicId: topics[m.topic], state: 'MASTERED', bestScore: score, attempts: opts2.attempt ?? 1, masteredAt: new Date(at) },
    });
    return sub;
  }

  // Karim: mastered 1–3 (eligible evaluator for Lea's hero mission).
  await validated(users.karim, 'm.area.tile', now - 12 * DAY, 88, 'tiles', { explanation: 'My room is 3.4 m by 3.1 m so the area is 10.54 m². 10.54 ÷ 1.5 = 7.03 so we need 8 boxes.', answers: { L: 3.4, W: 3.1, boxes: 8 } });
  await validated(users.karim, 'm.angles.ramp', now - 8 * DAY, 84, 'stairs', { explanation: 'Rise 60 cm, run 600 cm, 60/600 = 0.1 which is steeper than 1/12, so a ramp needs 720 cm.', answers: { rise: 60, run: 600 } });
  await validated(users.karim, 'm.similar.shadows', now - 4 * DAY, 91, 'shadow', { explanation: 'I am 1.62 m and my shadow was 2.2 m. The building shadow was 24 m so H = 24 × 1.62 / 2.2 = 17.7 m.', answers: { h: 1.62, s: 2.2, S: 24, H: 17.7 } });
  await xp(users.karim, 15, 'PEER_EVAL_GIVEN', now - 6 * DAY);
  await xp(users.karim, 15, 'PEER_EVAL_GIVEN', now - 3 * DAY);
  for (const t of ['geo.circles', 'geo.volume']) {
    await prisma.topicProgress.create({ data: { studentId: users.karim, topicId: topics[t], state: 'AVAILABLE' } });
  }

  // Lea: mastered 1–2, node 3 AVAILABLE, streak 3, level 2 (close to level 3), wallet 3.
  await validated(users.lea, 'm.area.tile', now - 9 * DAY, 86, 'tiles', { explanation: 'My bedroom is 3.6 m × 3.0 m = 10.8 m². 10.8 ÷ 1.5 = 7.2, so we buy 8 boxes.', answers: { L: 3.6, W: 3.0, boxes: 8 } });
  await validated(users.lea, 'm.angles.ramp', now - 1 * DAY, 82, 'stairs', { explanation: 'The steps rise 75 cm and there is 120 cm in front. 75/120 is way more than 1/12 so a safe ramp would need 9 m.', answers: { rise: 75, run: 120 } });
  await validated(users.lea, 'm.speed.walk', now - 2 * DAY, 90, 'walk', { explanation: '50 m in 38 s = 1.32 m/s = 4.7 km/h.', answers: { d: 50, t: 38, v: 4.7 }, subject: 'physics' });
  await xp(users.lea, 15, 'STREAK', now - 1 * DAY, 'math', 'streak-3');
  // Starting XP 255: the hero mission (≥ 50 XP) takes Lea to level 3 on camera.
  for (const d of [7, 5, 4, 3]) await xp(users.lea, 15, 'PEER_EVAL_GIVEN', now - d * DAY);
  await xp(users.lea, 5, 'HELPFUL_REVIEW', now - 4 * DAY);
  await xp(users.lea, 5, 'HELPFUL_REVIEW', now - 3 * DAY);
  for (const t of ['geo.similar', 'geo.circles', 'geo.volume']) {
    await prisma.topicProgress.create({ data: { studentId: users.lea, topicId: topics[t], state: 'AVAILABLE' } });
  }

  // Lea's family mission waiting for Mona's confirmation.
  const balcony = await saveIllustration(prisma, users.lea, school.id, 'balcony');
  await prisma.submission.create({
    data: {
      missionId: missions['m.family.balcony'].id,
      studentId: users.lea,
      status: 'FAMILY_CONFIRM',
      photoUploadIds: [balcony],
      explanation: 'Mom guessed 60 tiles, I guessed 75. The balcony is 4.2 m × 1.5 m = 6.3 m² and one tile is 0.09 m², so we need 70 tiles. I was closer!',
      answers: { area: 6.3, tiles: 70 },
      aiCheck: { score: 88, correct: true, perCriterion: [], feedback: 'Lovely teamwork and a correct calculation!', followUpQuestion: 'Why did you divide by 0.09?', flags: [] },
      followUpAnswer: 'Because each tile covers 0.09 square meters, so I count how many tiles fit in the area.',
      aiFollowUpCheck: { understood: true, scoreDelta: 4, feedback: 'Exactly!' },
      startedAt: new Date(now - 1.5 * DAY),
      submittedAt: new Date(now - 1.2 * DAY),
    },
  });

  // Omar: mastered 1, two retries on node 2 → stuck alert.
  await validated(users.omar, 'm.area.tile', now - 10 * DAY, 74, 'tiles', { explanation: 'Room 3 by 3 = 9. 9 / 1.5 = 6 boxes.', answers: { L: 3, W: 3, boxes: 6 } });
  await prisma.submission.create({
    data: {
      missionId: missions['m.angles.ramp'].id,
      studentId: users.omar,
      status: 'RETRY',
      attempt: 2,
      photoUploadIds: [],
      explanation: 'the ramp is ok',
      answers: { rise: 80 },
      aiCheck: { score: 38, correct: false, perCriterion: [], feedback: 'Good start! Measure the run too and compare rise ÷ run with 1 ÷ 12.', followUpQuestion: 'What does rise ÷ run tell you?', flags: ['explanation_missing'] },
      startedAt: new Date(now - 3 * DAY),
      submittedAt: new Date(now - 2 * DAY),
    },
  });
  await prisma.topicProgress.create({ data: { studentId: users.omar, topicId: topics['geo.angles'], state: 'IN_PROGRESS', attempts: 2 } });

  // Wallets & streaks
  const wallets: Record<string, number> = { [users.lea]: 3, [users.karim]: 4, [users.omar]: 3 };
  for (const [sid, pts] of Object.entries(wallets)) {
    await prisma.wallet.create({ data: { studentId: sid, points: pts } });
    await prisma.walletTx.create({ data: { studentId: sid, delta: 3, reason: 'TEACHER_GRANT', refId: 'welcome', createdAt: new Date(now - 14 * DAY) } });
  }
  await prisma.walletTx.create({ data: { studentId: users.karim, delta: 1, reason: 'EARNED_BY_REVIEWING', createdAt: new Date(now - 3 * DAY) } });
  await prisma.streak.create({ data: { studentId: users.lea, current: 3, longest: 4, lastActive: new Date(now - DAY) } });
  await prisma.streak.create({ data: { studentId: users.karim, current: 5, longest: 6, lastActive: new Date(now - DAY) } });
  await prisma.streak.create({ data: { studentId: users.omar, current: 0, longest: 2, lastActive: new Date(now - 3 * DAY) } });

  // Badges
  const badgeIds = Object.fromEntries((await prisma.badge.findMany()).map((b) => [b.key, b.id]));
  for (const sid of studentIds) await prisma.studentBadge.create({ data: { studentId: sid, badgeId: badgeIds.first_mission, earnedAt: new Date(now - 9 * DAY) } });
  await prisma.studentBadge.create({ data: { studentId: users.karim, badgeId: badgeIds.shadow_hunter, earnedAt: new Date(now - 4 * DAY) } });

  // Parent link: Mona → Lea
  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: users.mona, studentId: users.lea } },
    update: { status: 'VERIFIED' },
    create: { parentId: users.mona, studentId: users.lea, status: 'VERIFIED', method: 'FAMILY_CODE' },
  });

  // A message from the teacher
  await prisma.message.create({
    data: { fromId: users.rana, toId: users.mona, studentId: users.lea, body: 'Hello Mrs. Saliba! Lea did a great job on the ramp mission this week. Next: measuring your building with shadows ☀️', createdAt: new Date(now - DAY) },
  });

  // Stuck alert for Omar (also recomputed live by the dashboard)
  await prisma.notification.create({
    data: {
      userId: users.rana,
      type: 'STUCK_ALERT',
      payload: { classId: cls.id, studentId: users.omar, studentName: 'Omar Tannous', topicKey: 'geo.angles', topicName: pickText(TOPICS[1].name, 'en'), reasons: ['RETRIES'] },
      dedupeKey: `stuck:${users.rana}:${users.omar}:${topics['geo.angles']}:${dayKey(new Date())}`,
    },
  });
  // Pending teacher notification for the director
  const pendingMembership = await prisma.membership.findFirstOrThrow({ where: { userId: users.pending_teacher, schoolId: school.id } });
  await prisma.notification.create({
    data: { userId: users.director, type: 'MEMBER_PENDING', payload: { membershipId: pendingMembership.id, name: 'Nadine Fakhoury', role: 'TEACHER' }, dedupeKey: `pending:${pendingMembership.id}:${users.director}` },
  });

  await seedSchoolLife(prisma, { schoolId: school.id, teacherId: users.hassan, topics, missions: Object.fromEntries(Object.entries(missions).map(([k, v]) => [k, v.id])), now, mathSubjectId: subjects.math });

  log(`Seeded "${school.name}" (${school.schoolCode}): ${Object.keys(users).length} users, ${Object.keys(missions).length} missions, class ${cls.name}.`);
  return { school, users, class: cls, missions, topics, subjects };
}

/** Deterministic PRNG so the seeded school looks the same on every reset. */
function rng(seedN: number) {
  let a = seedN;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ali', 'Rita', 'Samir', 'Nadia', 'Fadi', 'Lina', 'Hussein', 'Christelle', 'Walid', 'Mira', 'Jad', 'Tala', 'Nour', 'Rayan', 'Celine', 'Yasmin', 'Mohamad', 'Perla', 'Wissam', 'Sarah', 'Karam', 'Joelle'];
const LAST = ['Khoury', 'Haddad', 'Daher', 'Rizk', 'Salam', 'Karam', 'Nasr', 'Hamdan', 'Saad', 'Aoun', 'Bitar', 'Jaber'];

/** A second teacher with two more classes and realistic progress, so the director dashboard has a school to show. */
async function seedSchoolLife(
  prisma: PrismaClient,
  ctx: { schoolId: string; teacherId: string; topics: Ids; missions: Record<string, string>; now: number; mathSubjectId: string },
) {
  const rand = rng(2036);
  const geoOrder = ['geo.area', 'geo.angles', 'geo.similar', 'geo.circles', 'geo.volume', 'geo.pythagoras'];
  const classes = [
    { name: '7A Math', grade: 7, size: 12, skill: 0.35 },
    { name: '9B Math', grade: 9, size: 10, skill: 0.7 },
  ];
  let n = 0;
  for (const c of classes) {
    const existing = await prisma.class.findFirst({ where: { schoolId: ctx.schoolId, name: c.name } });
    const cls = existing ?? (await prisma.class.create({ data: { schoolId: ctx.schoolId, name: c.name, gradeLevel: c.grade, settings: { leaderboardEnabled: true }, subjectId: ctx.mathSubjectId } }));
    if (existing) await prisma.class.update({ where: { id: cls.id }, data: { subjectId: ctx.mathSubjectId } });
    await prisma.classTeacher.upsert({
      where: { classId_teacherId: { classId: cls.id, teacherId: ctx.teacherId } },
      update: {},
      create: { classId: cls.id, teacherId: ctx.teacherId, type: 'OWNER' },
    });
    // Each class gets its own copy of the geometry missions.
    const topicMission: Record<string, string> = {};
    const slug = c.name.toLowerCase().replace(/\s+/g, '');
    for (const [key, src] of Object.entries(ctx.missions)) {
      if (!key.startsWith('m.') || key === 'm.family.balcony') continue;
      const base = await prisma.mission.findUniqueOrThrow({ where: { id: src } });
      if (!geoOrder.some((g) => g === (TOPICS.find((t) => ctx.topics[t.key] === base.topicId)?.key))) continue;
      const { id: _id, key: _k, classId: _c, createdAt: _ca, classroomCourseWorkId: _cw, ...rest } = base;
      const data = { ...rest, createdById: ctx.teacherId, classId: cls.id, title: rest.title as object, story: rest.story as object, steps: rest.steps as object, miniLesson: rest.miniLesson as object, proofSpec: rest.proofSpec as object, rubric: rest.rubric as object, safetyNotes: rest.safetyNotes as object, safetyCheck: (rest.safetyCheck ?? undefined) as object | undefined };
      const copy = await prisma.mission.upsert({ where: { key: `${key}.${slug}` }, update: data, create: { key: `${key}.${slug}`, ...data } });
      topicMission[TOPICS.find((t) => ctx.topics[t.key] === base.topicId)!.key] = copy.id;
    }
    for (let i = 0; i < c.size; i++, n++) {
      const name = `${FIRST[n % FIRST.length]} ${LAST[(n * 7) % LAST.length]}`;
      const googleId = `seed-life-${n}`;
      const user = await prisma.user.upsert({
        where: { googleId },
        update: {},
        create: { googleId, email: `student${n}@students.tripoli-future.school`, name, status: rand() > 0.15 ? 'ACTIVE' : 'INVITED' },
      });
      await prisma.membership.upsert({
        where: { userId_schoolId_role: { userId: user.id, schoolId: ctx.schoolId, role: 'STUDENT' } },
        update: {},
        create: { userId: user.id, schoolId: ctx.schoolId, role: 'STUDENT', status: 'APPROVED' },
      });
      await prisma.enrollment.upsert({ where: { classId_studentId: { classId: cls.id, studentId: user.id } }, update: { status: 'ACTIVE' }, create: { classId: cls.id, studentId: user.id } });
      // reset this student's activity
      await prisma.submission.deleteMany({ where: { studentId: user.id } });
      await prisma.xpEvent.deleteMany({ where: { studentId: user.id } });
      await prisma.topicProgress.deleteMany({ where: { studentId: user.id } });
      await prisma.wallet.upsert({ where: { studentId: user.id }, update: { points: 3 }, create: { studentId: user.id } });

      const masteredCount = Math.min(geoOrder.length, Math.floor(rand() * 3 + c.skill * 4));
      for (let t = 0; t < masteredCount; t++) {
        const key = geoOrder[t];
        if (key === 'geo.similar' && t < 2) continue;
        const daysAgo = Math.floor(rand() * 13 * (1 - t / 8));
        const at = ctx.now - daysAgo * DAY - Math.floor(rand() * DAY / 2);
        const score = 70 + Math.floor(rand() * 28);
        await prisma.submission.create({
          data: {
            missionId: topicMission[key],
            studentId: user.id,
            status: 'VALIDATED',
            photoUploadIds: [],
            explanation: 'Seeded history',
            finalScore: score,
            gradeSynced: true,
            startedAt: new Date(at - DAY),
            submittedAt: new Date(at - DAY / 2),
            validatedAt: new Date(at),
          },
        });
        await prisma.xpEvent.create({ data: { studentId: user.id, amount: 60, reason: 'MISSION_VALIDATED', createdAt: new Date(at) } });
        await prisma.topicProgress.create({ data: { studentId: user.id, topicId: ctx.topics[key], state: 'MASTERED', bestScore: score, attempts: 1, masteredAt: new Date(at) } });
      }
      // a few students are stuck
      if (rand() < 0.12 && masteredCount < geoOrder.length) {
        await prisma.submission.create({
          data: {
            missionId: topicMission[geoOrder[masteredCount]],
            studentId: user.id,
            status: 'RETRY',
            attempt: 2,
            photoUploadIds: [],
            explanation: 'Seeded retry',
            aiCheck: { score: 40, correct: false, perCriterion: [], feedback: 'Almost!', followUpQuestion: '', flags: [] },
            startedAt: new Date(ctx.now - 2 * DAY),
          },
        });
      }
      if (rand() < 0.45) {
        const pid = `seed-life-parent-${n}`;
        const parent = await prisma.user.upsert({
          where: { googleId: pid },
          update: {},
          create: { googleId: pid, email: `parent${n}@family.example`, name: `Parent of ${name.split(' ')[0]}`, locale: 'ar' },
        });
        await prisma.membership.upsert({
          where: { userId_schoolId_role: { userId: parent.id, schoolId: ctx.schoolId, role: 'PARENT' } },
          update: {},
          create: { userId: parent.id, schoolId: ctx.schoolId, role: 'PARENT', status: 'APPROVED' },
        });
        await prisma.parentLink.upsert({
          where: { parentId_studentId: { parentId: parent.id, studentId: user.id } },
          update: {},
          create: { parentId: parent.id, studentId: user.id, status: 'VERIFIED', method: 'FAMILY_CODE' },
        });
      }
    }
  }
}
