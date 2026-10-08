# Phase 1 — School Subjects & Teacher Invites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Directors define their school's subjects; teacher invites (and code-joins) carry ≥1 subject; teachers' subjects are stored and editable.

**Architecture:** `Subject` becomes school-owned (`schoolId`, nullable for legacy global rows). New `TeacherSubject` join table; `Invite.subjectIds`; `Class.subjectId` column added now (used by delete-guard and seed; wired to import in Phase 2). A new `subject` permission resource in `packages/shared`. API endpoints live in a new `SchoolSubjectsController` inside the existing `subjects` module. Web: director Subjects page, subject picker in invite form / members list / onboarding join.

**Tech Stack:** NestJS 11, Prisma 7 (PostgreSQL), zod 4, Next.js 15 + next-intl, TanStack Query, Jest + Supertest.

**Spec:** `docs/superpowers/specs/2026-10-08-real-curriculum-design.md` (section 1, plus `Class.subjectId` from section 2).

## Global Constraints

- Run commands from repo root `/home/royhelwe/Desktop/Project/experia_hackathon`. Local Postgres: `docker compose up -d db`; test DB `tajriba_test` exists.
- After editing `packages/shared`, run `pnpm --filter @tajriba/shared build` before API tests (API imports the built package).
- After editing `schema.prisma`, run `cd apps/api && DATABASE_URL=postgresql://tajriba:tajriba@localhost:5432/tajriba npx prisma migrate dev --name <name> --create-only`, inspect SQL, then `npx prisma generate`. Tests apply migrations automatically.
- Default-deny permissions: every endpoint declares `@Can(action, resource)` and services do object-level `actors.assert(...)`.
- Every user-visible string goes in `apps/web/messages/en/*.json` AND `apps/web/messages/ar/*.json`.
- Never send student names/emails to AI. Subject names are fine.
- Existing 36 API tests + shared unit tests must stay green. Pre-existing lint errors at `apps/api/src/seed/seed.ts:335` are out of scope.
- Commit after each task with a descriptive message (no attribution trailer required).

## Review Focus

1. Director creates a subject whose name already exists in the school (any case) → expect `409` "This subject already exists", not a duplicate row.
2. Invite with a `subjectId` from another school → expect `400`, nothing created.
3. Teacher membership approved after a code-join with subjects → `TeacherSubject` rows already exist and appear in Members; rejecting the membership deletes them.
4. Deleting a subject that a class uses → `409`; deleting an unused one also removes its `TeacherSubject` rows (cascade).
5. Demo school (TRP-2036) after re-seed: still exactly its 6 subjects, `rana`/`hassan` linked to Math, golden path untouched.

---

### Task 1: Data model + shared permissions & schemas

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (models `School`, `User`, `Subject`, `Class`, `Invite`; new `TeacherSubject`)
- Create: `apps/api/prisma/migrations/<timestamp>_school_subjects/migration.sql` (generated)
- Modify: `packages/shared/src/permissions.ts` (add `subject` resource + rules)
- Modify: `packages/shared/src/schemas.ts` (new bodies, extend invite/join)
- Test: `packages/shared/src/permissions.test.ts`

**Interfaces:**
- Produces: Prisma models `Subject { schoolId String?; school School?; classes Class[]; teachers TeacherSubject[] }`, `TeacherSubject { teacherId, schoolId, subjectId }`, `Class.subjectId String?`, `Invite.subjectIds String[]`.
- Produces (shared): resource `'subject'`; zod `createSubjectBody {name 1-60, color?, icon?}`, `updateSubjectBody` (all optional), `setTeacherSubjectsBody {subjectIds: string[] min 1}`, `createInviteBody.subjectIds?: string[]`, `joinSchoolBody.subjectIds?: string[]`; constants `SUBJECT_COLORS`, `SUBJECT_ICONS`.

- [ ] **Step 1: Write failing permission tests** — append to `packages/shared/src/permissions.test.ts`:

```ts
describe('permissions — subject', () => {
  it('director/admin read & write school subjects', () => {
    for (const a of [director, admin]) {
      expect(can(a, 'read', 'subject', { schoolId: S })).toBe(true);
      expect(can(a, 'write', 'subject', { schoolId: S })).toBe(true);
    }
  });
  it('everyone else reads only', () => {
    for (const a of [teacher, student, parent]) {
      expect(can(a, 'read', 'subject', { schoolId: S })).toBe(true);
      expect(can(a, 'write', 'subject', { schoolId: S })).toBe(false);
    }
  });
  it('other school denied', () => {
    expect(can(director, 'write', 'subject', { schoolId: 'other' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @tajriba/shared test -- permissions` → FAIL (type error / `'subject'` not a Resource).

- [ ] **Step 3: Implement shared changes.** In `permissions.ts`: add `'subject'` to `RESOURCES`; in `ROLE_TABLE` add `subject: ['read', 'write']` to DIRECTOR and ADMIN, `subject: ['read']` to TEACHER, STUDENT, PARENT; in `can()` add before `case 'family':`

```ts
    case 'subject':
      if (isAdmin) return true;
      return action === 'read';
```

In `schemas.ts` (near the other request bodies):

```ts
export const SUBJECT_COLORS = ['violet', 'sky', 'mint', 'green', 'coral', 'sunny', 'pink', 'slate'] as const;
export const SUBJECT_ICONS = ['triangle', 'zap', 'flask', 'leaf', 'landmark', 'languages', 'book', 'globe', 'music', 'palette', 'cpu', 'dumbbell'] as const;
export const createSubjectBody = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(SUBJECT_COLORS).optional(),
  icon: z.enum(SUBJECT_ICONS).optional(),
});
export const updateSubjectBody = createSubjectBody.partial();
export const setTeacherSubjectsBody = z.object({ subjectIds: z.array(z.string()).min(1).max(20) });
```

Extend existing bodies:

```ts
export const joinSchoolBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}-\d{4}$/),
  role: z.enum(['TEACHER', 'STUDENT']).default('TEACHER'),
  subjectIds: z.array(z.string()).max(20).optional(),
});
export const createInviteBody = z.object({
  email: z.email(),
  role: z.enum(ROLES),
  studentId: z.string().optional(),
  subjectIds: z.array(z.string()).max(20).optional(),
});
```

- [ ] **Step 4: Run** `pnpm --filter @tajriba/shared test && pnpm --filter @tajriba/shared build` → PASS.

- [ ] **Step 5: Prisma schema.** Add to `Subject`:

```prisma
model Subject {
  id       String  @id @default(cuid())
  key      String  @unique
  schoolId String?
  name     Json
  color    String
  icon     String

  school   School?          @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  topics   Topic[]
  classes  Class[]
  teachers TeacherSubject[]

  @@index([schoolId])
}

model TeacherSubject {
  teacherId String
  schoolId  String
  subjectId String

  teacher User    @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  school  School  @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  subject Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  @@id([teacherId, subjectId])
  @@index([schoolId])
}
```

`Class`: add `subjectId String?` and `subject Subject? @relation(fields: [subjectId], references: [id], onDelete: SetNull)`. `Invite`: add `subjectIds String[] @default([])`. Add back-relations `subjects Subject[]` and `teacherSubjects TeacherSubject[]` to `School`, and `teacherSubjects TeacherSubject[]` to `User`.

- [ ] **Step 6: Generate migration** — `cd apps/api && DATABASE_URL=postgresql://tajriba:tajriba@localhost:5432/tajriba npx prisma migrate dev --name school_subjects --create-only && npx prisma generate`. Check the SQL only adds columns/tables (no drops).

- [ ] **Step 7: Run** `pnpm --filter @tajriba/api typecheck` → PASS.

- [ ] **Step 8: Commit** `git add packages/shared apps/api/prisma && git commit -m "Make subjects school-owned and add teacher subjects"`

---

### Task 2: Seed + subject listing scoped to the active school

**Files:**
- Modify: `apps/api/src/seed/seed.ts:87-91` (subjects get `schoolId`), seeded classes get `subjectId`, `rana`/`hassan` get `TeacherSubject(math)`
- Modify: `apps/api/src/subjects/subjects.service.ts` (`list(a)` scoped)
- Modify: `apps/api/src/subjects/subjects.controller.ts` (pass auth)
- Test: create `apps/api/test/subjects.spec.ts`

**Interfaces:**
- Consumes: Task 1 models.
- Produces: `SubjectsService.list(a: AuthContext)` returning `{ id, key, name, color, icon, topicCount }[]` for the actor's school; `SubjectsService.schoolSubjectIds(schoolId: string): Promise<string[]>`.

- [ ] **Step 1: Failing test** — `apps/api/test/subjects.spec.ts`:

```ts
import { AuthService } from '../src/auth/auth.service';
import { createTestApp, TestCtx } from './app';

describe('school subjects (integration)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.app.close());

  it('seed: demo school owns its 6 subjects; seeded teachers teach math; seeded classes are math', async () => {
    const school = await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } });
    const subjects = await ctx.prisma.subject.findMany({ where: { schoolId: school.id } });
    expect(subjects.map((s) => s.key).sort()).toEqual(['biology', 'chemistry', 'history', 'languages', 'math', 'physics']);
    const math = subjects.find((s) => s.key === 'math')!;
    const rana = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'rana' } });
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: rana.id, subjectId: math.id } })).toBe(1);
    const classes = await ctx.prisma.class.findMany({ where: { schoolId: school.id } });
    expect(classes.every((c) => c.subjectId === math.id)).toBe(true);
  });

  it('GET /subjects lists only the active school subjects', async () => {
    const lea = await ctx.as('lea');
    const list = (await ctx.http().get('/subjects').set('Cookie', lea).expect(200)).body;
    expect(list.map((s: { key: string }) => s.key)).toContain('math');
    const auth = ctx.app.get(AuthService);
    const dir = await auth.upsertFromGoogle({ googleId: 'g-new-dir', email: 'newdir@x.test', name: 'New Dir' });
    const created = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(dir.id)).send({ name: 'Empty School', city: 'Saida' }).expect(201);
    const session = created.headers['set-cookie'][0].split(';')[0];
    expect((await ctx.http().get('/subjects').set('Cookie', session).expect(200)).body).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @tajriba/api test -- subjects.spec` → FAIL.

- [ ] **Step 3: Seed.** In `seed.ts` subjects loop:

```ts
  const subjects: Ids = {};
  for (const s of SUBJECTS) {
    const row = await prisma.subject.upsert({
      where: { key: s.key },
      update: { name: s.name, color: s.color, icon: s.icon, schoolId: school.id },
      create: { ...s, schoolId: school.id },
    });
    subjects[s.key] = row.id;
  }
  for (const handle of ['rana', 'hassan'] as const) {
    await prisma.teacherSubject.upsert({
      where: { teacherId_subjectId: { teacherId: users[handle], subjectId: subjects.math } },
      update: {},
      create: { teacherId: users[handle], schoolId: school.id, subjectId: subjects.math },
    });
  }
```

Add `subjectId: subjects.math` to the `8B Math` class `update` and `create` data (line ~112). In the extra-classes helper (line ~322) the context needs the math id: add `mathSubjectId: string` to that helper's `ctx` parameter type (`seed.ts:311`) and pass `mathSubjectId: subjects.math` where the helper is called, and set `subjectId: ctx.mathSubjectId` in `prisma.class.create` plus `await prisma.class.update({ where: { id: cls.id }, data: { subjectId: ctx.mathSubjectId } })` when `existing`.

- [ ] **Step 4: Scoped list.** `subjects.service.ts`:

```ts
  async list(a: AuthContext) {
    const actor = await this.actors.actor(a);
    const subjects = await this.prisma.subject.findMany({
      where: { schoolId: actor.schoolId },
      include: { _count: { select: { topics: true } } },
    });
    return subjects
      .sort((x, y) => pickName(x.name).localeCompare(pickName(y.name)))
      .map((s) => ({ id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon, topicCount: s._count.topics }));
  }

  async schoolSubjectIds(schoolId: string) {
    return (await this.prisma.subject.findMany({ where: { schoolId }, select: { id: true } })).map((s) => s.id);
  }
```

with `const pickName = (n: unknown) => ((n as { en?: string })?.en ?? '');` at module top. Controller: `list(@Auth() a: AuthContext) { return this.subjects.list(a); }`.

- [ ] **Step 5: Run** `pnpm --filter @tajriba/api test` → all PASS (including `golden-loop` which reads `/subjects/math/graph`).

- [ ] **Step 6: Commit** `git commit -am "Seed demo subjects into the demo school and scope /subjects"` (add new test file first).

---

### Task 3: Subjects CRUD for directors (+ AI translation)

**Files:**
- Create: `apps/api/src/ai/tasks/translate-name.ts`; Modify: `apps/api/src/ai/tasks/index.ts`
- Create: `apps/api/src/subjects/school-subjects.controller.ts`, `apps/api/src/subjects/school-subjects.service.ts`
- Modify: `apps/api/src/subjects/subjects.module.ts` (register controller/service; import AiModule if not global — check `ai.module.ts`)
- Test: `apps/api/test/subjects.spec.ts` (append)

**Interfaces:**
- Consumes: `AiService.run(task, input)` (`apps/api/src/ai/ai.service.ts:44`), `defineTask` (`ai/task.ts`).
- Produces: `GET/POST /schools/:id/subjects`, `PATCH/DELETE /schools/:id/subjects/:subjectId`. Response row: `{ id, key, name: {en, ar}, color, icon, classCount, teacherCount }`.

- [ ] **Step 1: Failing tests** (append inside the describe):

```ts
  it('director CRUD: create (AI fills Arabic), duplicate 409, rename, delete guard', async () => {
    const auth = ctx.app.get(AuthService);
    const dir = await auth.upsertFromGoogle({ googleId: 'g-crud-dir', email: 'crud@x.test', name: 'Crud Dir' });
    const created = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(dir.id)).send({ name: 'Crud School', city: 'Tyre' }).expect(201);
    const c = created.headers['set-cookie'][0].split(';')[0];
    const sid = created.body.id;

    const phys = (await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', c).send({ name: 'Physics', color: 'sky', icon: 'zap' }).expect(201)).body;
    expect(phys.name.en).toBe('Physics');
    expect(typeof phys.name.ar).toBe('string');
    expect(phys.key).toMatch(/^s_/);
    await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', c).send({ name: '  physics ' }).expect(409);

    const renamed = (await ctx.http().patch(`/schools/${sid}/subjects/${phys.id}`).set('Cookie', c).send({ name: 'Physics & Science' }).expect(200)).body;
    expect(renamed.name.en).toBe('Physics & Science');

    const list = (await ctx.http().get(`/schools/${sid}/subjects`).set('Cookie', c).expect(200)).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ classCount: 0, teacherCount: 0 });

    const cls = await ctx.prisma.class.create({ data: { schoolId: sid, name: '9 Phys', subjectId: phys.id } });
    await ctx.http().delete(`/schools/${sid}/subjects/${phys.id}`).set('Cookie', c).expect(409);
    await ctx.prisma.class.delete({ where: { id: cls.id } });
    await ctx.http().delete(`/schools/${sid}/subjects/${phys.id}`).set('Cookie', c).expect(200);
    expect(await ctx.prisma.subject.count({ where: { schoolId: sid } })).toBe(0);
  });

  it('teachers cannot write subjects; other schools cannot read them', async () => {
    const rana = await ctx.as('rana');
    const school = await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } });
    await ctx.http().get(`/schools/${school.id}/subjects`).set('Cookie', rana).expect(200);
    await ctx.http().post(`/schools/${school.id}/subjects`).set('Cookie', rana).send({ name: 'Art' }).expect(403);
    const auth = ctx.app.get(AuthService);
    const outsider = await auth.upsertFromGoogle({ googleId: 'g-out', email: 'out@x.test', name: 'Out' });
    const created = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(outsider.id)).send({ name: 'Other', city: 'Zahle' }).expect(201);
    const oc = created.headers['set-cookie'][0].split(';')[0];
    await ctx.http().get(`/schools/${school.id}/subjects`).set('Cookie', oc).expect(403);
  });
```

- [ ] **Step 2: Run** → FAIL (404 routes).

- [ ] **Step 3: AI task** `apps/api/src/ai/tasks/translate-name.ts`:

```ts
import { z } from 'zod';
import { defineTask, JSON_RULES } from '../task';

export interface TranslateNameInput {
  text: string;
}
const output = z.object({ en: z.string().min(1).max(80), ar: z.string().min(1).max(80) });

/** Short school-subject name → English + Arabic. */
export const translateName = defineTask({
  name: 'translateName',
  model: 'fast',
  schema: output,
  system: `You translate a school subject name. Return the English name and the Modern Standard Arabic name a Lebanese school would use. Keep it short (1-4 words). If the input is already Arabic, translate to English for "en". ${JSON_RULES}
Schema: {"en":string,"ar":string}`,
  user: (i: TranslateNameInput) => `Subject name: ${i.text}`,
  mock: (i: TranslateNameInput) => ({ en: i.text, ar: i.text }),
});
```

Export it from `ai/tasks/index.ts` (`export * from './translate-name';`).

- [ ] **Step 4: Service** `school-subjects.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { translateName } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { PrismaService } from '../prisma/prisma.service';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const enName = (n: unknown) => (n as { en?: string })?.en ?? '';

@Injectable()
export class SchoolSubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
  ) {}

  async list(a: AuthContext, schoolId: string) {
    await this.actors.assert(a, 'read', 'subject', { schoolId });
    const rows = await this.prisma.subject.findMany({
      where: { schoolId },
      include: { _count: { select: { classes: true, teachers: true } } },
    });
    return rows
      .sort((x, y) => enName(x.name).localeCompare(enName(y.name)))
      .map((s) => ({ id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon, classCount: s._count.classes, teacherCount: s._count.teachers }));
  }

  private async assertUnique(schoolId: string, name: string, exceptId?: string) {
    const all = await this.prisma.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
    const n = norm(name);
    if (all.some((s) => s.id !== exceptId && (norm(enName(s.name)) === n || norm((s.name as { ar?: string })?.ar ?? '') === n)))
      throw new ConflictException({ message: 'This subject already exists.' });
  }

  private async bilingual(name: string) {
    try {
      return await this.ai.run(translateName, { text: name.trim() });
    } catch {
      return { en: name.trim(), ar: name.trim() };
    }
  }

  async create(a: AuthContext, schoolId: string, body: { name: string; color?: string; icon?: string }) {
    await this.actors.assert(a, 'write', 'subject', { schoolId });
    await this.assertUnique(schoolId, body.name);
    const name = await this.bilingual(body.name);
    const s = await this.prisma.subject.create({
      data: { schoolId, key: `s_${randomUUID().slice(0, 12)}`, name, color: body.color ?? 'violet', icon: body.icon ?? 'book' },
    });
    return { id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon, classCount: 0, teacherCount: 0 };
  }

  private async own(schoolId: string, subjectId: string) {
    const s = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!s || s.schoolId !== schoolId) throw new NotFoundException();
    return s;
  }

  async update(a: AuthContext, schoolId: string, subjectId: string, body: { name?: string; color?: string; icon?: string }) {
    await this.actors.assert(a, 'write', 'subject', { schoolId });
    await this.own(schoolId, subjectId);
    const data: { name?: { en: string; ar: string }; color?: string; icon?: string } = { color: body.color, icon: body.icon };
    if (body.name) {
      await this.assertUnique(schoolId, body.name, subjectId);
      data.name = await this.bilingual(body.name);
    }
    const s = await this.prisma.subject.update({ where: { id: subjectId }, data });
    return { id: s.id, key: s.key, name: s.name, color: s.color, icon: s.icon };
  }

  async remove(a: AuthContext, schoolId: string, subjectId: string) {
    await this.actors.assert(a, 'write', 'subject', { schoolId });
    await this.own(schoolId, subjectId);
    if (await this.prisma.class.count({ where: { subjectId } }))
      throw new ConflictException({ message: 'Classes still use this subject. Move them to another subject first.' });
    await this.prisma.subject.delete({ where: { id: subjectId } });
    return { ok: true };
  }
}
```

`AiModule` is `@Global()`, so `AiService` is injectable without imports; identical requests are cached by `AI_CACHE`.

- [ ] **Step 5: Controller** `school-subjects.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { createSubjectBody, updateSubjectBody } from '@tajriba/shared';
import { z } from 'zod';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { SchoolSubjectsService } from './school-subjects.service';

@Controller('schools/:schoolId/subjects')
export class SchoolSubjectsController {
  constructor(private readonly subjects: SchoolSubjectsService) {}

  @Can('read', 'subject')
  @Get()
  list(@Auth() a: AuthContext, @Param('schoolId') schoolId: string) {
    return this.subjects.list(a, schoolId);
  }

  @Can('write', 'subject')
  @Post()
  create(@Auth() a: AuthContext, @Param('schoolId') schoolId: string, @Body(new ZodPipe(createSubjectBody)) body: z.infer<typeof createSubjectBody>) {
    return this.subjects.create(a, schoolId, body);
  }

  @Can('write', 'subject')
  @Patch(':subjectId')
  update(
    @Auth() a: AuthContext,
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Body(new ZodPipe(updateSubjectBody)) body: z.infer<typeof updateSubjectBody>,
  ) {
    return this.subjects.update(a, schoolId, subjectId, body);
  }

  @Can('write', 'subject')
  @Delete(':subjectId')
  remove(@Auth() a: AuthContext, @Param('schoolId') schoolId: string, @Param('subjectId') subjectId: string) {
    return this.subjects.remove(a, schoolId, subjectId);
  }
}
```

Register both in `subjects.module.ts` (`controllers: [SubjectsController, SchoolSubjectsController]`, `providers: [..., SchoolSubjectsService]`; import `AiModule` if `AiService` isn't exported globally).

Note: Nest routes `schools/:id` (SchoolsController `@Get(':id')`) and `schools/:schoolId/subjects` don't clash (different segment counts).

- [ ] **Step 6: Run** `pnpm --filter @tajriba/api test -- subjects.spec` → PASS; then full `pnpm --filter @tajriba/api test` → PASS.

- [ ] **Step 7: Commit** `git add apps/api && git commit -m "Let directors manage school subjects"`

---

### Task 4: Teacher subjects on invites, code-joins and members

**Files:**
- Modify: `apps/api/src/schools/schools.service.ts` (`createInvite`, `acceptInvite`, `join`, `decide`, `members`; new `setTeacherSubjects`, `subjectsByCode`)
- Modify: `apps/api/src/schools/schools.controller.ts` (pass `subjectIds`; `PUT /memberships/:id/subjects`; `GET /schools/by-code/:code/subjects` public)
- Test: create `apps/api/test/teacher-subjects.spec.ts`

**Interfaces:**
- Consumes: Task 1 `TeacherSubject`, shared `setTeacherSubjectsBody`.
- Produces: `members()` rows gain `subjects: { id, name }[]` (TEACHER rows; `[]` otherwise). `GET /schools/by-code/:code/subjects` → `{ school: { name }, subjects: { id, name }[] }`.

- [ ] **Step 1: Failing tests** — `apps/api/test/teacher-subjects.spec.ts`:

```ts
import { AuthService } from '../src/auth/auth.service';
import { createTestApp, TestCtx } from './app';

describe('teacher subjects (integration)', () => {
  let ctx: TestCtx;
  let sid: string;
  let dirCookie: string;
  let phys: { id: string };
  let chem: { id: string };
  let code: string;
  beforeAll(async () => {
    ctx = await createTestApp({ seed: false });
    const auth = ctx.app.get(AuthService);
    const dir = await auth.upsertFromGoogle({ googleId: 'g-d', email: 'd@x.test', name: 'Dir' });
    const created = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(dir.id)).send({ name: 'S', city: 'Beirut' }).expect(201);
    dirCookie = created.headers['set-cookie'][0].split(';')[0];
    sid = created.body.id;
    code = created.body.schoolCode;
    phys = (await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', dirCookie).send({ name: 'Physics' }).expect(201)).body;
    chem = (await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', dirCookie).send({ name: 'Chemistry' }).expect(201)).body;
  });
  afterAll(async () => ctx.app.close());

  it('teacher invite requires ≥1 subject from this school; accept stores them', async () => {
    await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER' }).expect(400);
    await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER', subjectIds: ['nope'] }).expect(400);
    const inv = (await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER', subjectIds: [phys.id] }).expect(201)).body;
    const t = await ctx.app.get(AuthService).upsertFromGoogle({ googleId: 'g-t1', email: 't1@x.test', name: 'Tala' });
    await ctx.http().post(`/invites/${inv.token}/accept`).set('Cookie', ctx.cookieFor(t.id)).expect(201);
    const rows = await ctx.prisma.teacherSubject.findMany({ where: { teacherId: t.id } });
    expect(rows.map((r) => r.subjectId)).toEqual([phys.id]);
    const members = (await ctx.http().get(`/schools/${sid}/members?status=APPROVED`).set('Cookie', dirCookie).expect(200)).body;
    const row = members.find((m: { user: { email: string } }) => m.user.email === 't1@x.test');
    expect(row.subjects.map((s: { id: string }) => s.id)).toEqual([phys.id]);
  });

  it('code-join with subjects; reject removes them; director edits subjects', async () => {
    const pub = (await ctx.http().get(`/schools/by-code/${code}/subjects`).expect(200)).body;
    expect(pub.subjects).toHaveLength(2);
    const t = await ctx.app.get(AuthService).upsertFromGoogle({ googleId: 'g-t2', email: 't2@x.test', name: 'Tarek' });
    const tc = ctx.cookieFor(t.id);
    const joined = (await ctx.http().post('/schools/join').set('Cookie', tc).send({ code, role: 'TEACHER', subjectIds: [chem.id] }).expect(201)).body;
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(1);
    await ctx.http().put(`/memberships/${joined.membership.id}/subjects`).set('Cookie', dirCookie).send({ subjectIds: [phys.id, chem.id] }).expect(200);
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(2);
    await ctx.http().put(`/memberships/${joined.membership.id}/subjects`).set('Cookie', tc).send({ subjectIds: [phys.id] }).expect(403);
    await ctx.http().post(`/memberships/${joined.membership.id}/reject`).set('Cookie', dirCookie).expect(201);
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(0);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Service changes** in `schools.service.ts`:

```ts
  /** Throws 400 unless every id is a subject of this school. */
  private async validSubjectIds(schoolId: string, ids: string[] | undefined): Promise<string[]> {
    const unique = [...new Set(ids ?? [])];
    if (!unique.length) return [];
    const found = await this.prisma.subject.count({ where: { id: { in: unique }, schoolId } });
    if (found !== unique.length) throw new BadRequestException({ message: 'Pick subjects from your school list.' });
    return unique;
  }

  private async replaceTeacherSubjects(teacherId: string, schoolId: string, subjectIds: string[]) {
    await this.prisma.$transaction([
      this.prisma.teacherSubject.deleteMany({ where: { teacherId, schoolId } }),
      this.prisma.teacherSubject.createMany({ data: subjectIds.map((subjectId) => ({ teacherId, schoolId, subjectId })), skipDuplicates: true }),
    ]);
  }
```

- `createInvite(a, body: { email; role; studentId?; subjectIds? })`: after the role checks, `const subjectIds = body.role === 'TEACHER' ? await this.validSubjectIds(actor.schoolId, body.subjectIds) : [];` and `if (body.role === 'TEACHER' && !subjectIds.length) throw new BadRequestException({ message: 'Choose at least one subject for this teacher.' });` — store `subjectIds` on the invite.
- `acceptInvite`: after the membership upsert, `if (invite.role === 'TEACHER' && invite.subjectIds.length) await this.replaceTeacherSubjects(a.userId, invite.schoolId, invite.subjectIds);`
- `join(a, code, role, subjectIds?)`: when `role === 'TEACHER'`, validate and `replaceTeacherSubjects` right after creating (or finding) the membership.
- `decide`: when `status === 'REJECTED' && m.role === 'TEACHER'`, `await this.prisma.teacherSubject.deleteMany({ where: { teacherId: m.userId, schoolId: m.schoolId } })`.
- `members`: include subjects:

```ts
    const teacherIds = rows.filter((m) => m.role === 'TEACHER').map((m) => m.userId);
    const ts = await this.prisma.teacherSubject.findMany({
      where: { schoolId, teacherId: { in: teacherIds } },
      include: { subject: { select: { id: true, name: true } } },
    });
    return rows.map((m) => ({
      id: m.id, role: m.role, status: m.status, createdAt: m.createdAt, user: m.user,
      subjects: m.role === 'TEACHER' ? ts.filter((x) => x.teacherId === m.userId).map((x) => x.subject) : [],
    }));
```

- New:

```ts
  async setTeacherSubjects(a: AuthContext, membershipId: string, subjectIds: string[]) {
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m || m.role !== 'TEACHER') throw new NotFoundException();
    await this.actors.assert(a, 'write', 'members', { schoolId: m.schoolId });
    const ids = await this.validSubjectIds(m.schoolId, subjectIds);
    await this.replaceTeacherSubjects(m.userId, m.schoolId, ids);
    return { ok: true, subjectIds: ids };
  }

  async subjectsByCode(code: string) {
    const school = await this.prisma.school.findUnique({ where: { schoolCode: code.toUpperCase() }, include: { subjects: true } });
    if (!school) throw new NotFoundException({ message: "We couldn't find a school with that code. Check it with your director." });
    return { school: { name: school.name }, subjects: school.subjects.map((s) => ({ id: s.id, name: s.name })) };
  }
```

- [ ] **Step 4: Controller** — `SchoolsController`: add **before** `@Get(':id')`:

```ts
  @Public()
  @Get('by-code/:code/subjects')
  subjectsByCode(@Param('code') code: string) {
    return this.schools.subjectsByCode(code);
  }
```

`join(...)` passes `body.subjectIds`. `MembershipsController` add:

```ts
  @Can('write', 'members')
  @Put(':id/subjects')
  setSubjects(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(setTeacherSubjectsBody)) body: z.infer<typeof setTeacherSubjectsBody>) {
    return this.schools.setTeacherSubjects(a, id, body.subjectIds);
  }
```

(import `Put`, `setTeacherSubjectsBody`). `InvitesController.create` body type gains `subjectIds?: string[]`.

- [ ] **Step 5: Run** full `pnpm --filter @tajriba/api test` → PASS. Run `pnpm --filter @tajriba/api typecheck`.

- [ ] **Step 6: Commit** `git add apps/api && git commit -m "Attach subjects to teacher invites, joins and memberships"`

---

### Task 5: Web — director Subjects page, nav, nudge

**Files:**
- Create: `apps/web/src/app/director/subjects/page.tsx`
- Create: `apps/web/src/components/director/subject-form.tsx`
- Create: `apps/web/src/components/director/subject-chip.tsx` (shared chip used in Task 6 too)
- Modify: `apps/web/src/app/director/layout.tsx` (nav item `BookOpen` icon → `/director/subjects`)
- Modify: `apps/web/src/app/director/page.tsx` (nudge card when 0 subjects)
- Modify: `apps/web/src/components/director/types.ts` (add `SchoolSubject`)
- Modify: `apps/web/messages/en/director.json`, `apps/web/messages/ar/director.json` (`nav.subjects`, `subjects.*`)

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /schools/:id/subjects` (Task 3); `useSchoolId()` (`components/director/use-school.ts`), `useApi`, `api`, `ApiError`, UI kit (`components/ui/*`), `PageHeader`, `useToast`.
- Produces: `type SchoolSubject = { id: string; key: string; name: { en: string; ar?: string }; color: string; icon: string; classCount: number; teacherCount: number }`; `<SubjectChip subject={{ name, color }} />`; `subjectLabel(name, locale)` helper in `subject-chip.tsx`.

- [ ] **Step 1:** Add i18n keys (en):

```json
"nav": { "...existing": "...", "subjects": "Subjects" },
"subjects": {
  "title": "Subjects",
  "subtitle": "The subjects your school teaches. Teachers are invited per subject, and imported classes are matched to them.",
  "add": "Add subject",
  "namePlaceholder": "e.g. Physics",
  "color": "Color",
  "icon": "Icon",
  "save": "Save",
  "rename": "Edit",
  "delete": "Delete",
  "deleteBlocked": "Classes still use this subject",
  "empty": "No subjects yet. Add the subjects your school teaches.",
  "classes": "{n, plural, one {# class} other {# classes}}",
  "teachers": "{n, plural, one {# teacher} other {# teachers}}",
  "nudgeTitle": "Add your school's subjects",
  "nudgeBody": "Teachers are invited per subject, and Tajriba uses them to sort imported classes.",
  "nudgeCta": "Add subjects"
}
```

and Arabic equivalents in `ar/director.json` (`"subjects": "المواد"`, `"title": "المواد"`, `"add": "إضافة مادة"`, `"namePlaceholder": "مثلاً: الفيزياء"`, `"color": "اللون"`, `"icon": "الأيقونة"`, `"save": "حفظ"`, `"rename": "تعديل"`, `"delete": "حذف"`, `"deleteBlocked": "هناك صفوف تستخدم هذه المادة"`, `"empty": "لا توجد مواد بعد. أضف المواد التي تدرّسها مدرستك."`, `"classes": "{n, plural, one {صف واحد} other {# صفوف}}"`, `"teachers": "{n, plural, one {معلّم واحد} other {# معلّمين}}"`, `"nudgeTitle": "أضف مواد مدرستك"`, `"nudgeBody": "تتم دعوة المعلّمين حسب المادة، وتستخدمها تجربة لتصنيف الصفوف المستوردة."`, `"nudgeCta": "إضافة المواد"`, `"subtitle": "المواد التي تدرّسها مدرستك. تتم دعوة المعلّمين حسب المادة وتُطابَق الصفوف المستوردة معها."`).

- [ ] **Step 2:** `subject-chip.tsx`:

```tsx
import { cn } from '@/lib/cn';

const BG: Record<string, string> = {
  violet: 'bg-violet-soft', sky: 'bg-sky-soft', mint: 'bg-mint-soft', green: 'bg-green-soft',
  coral: 'bg-coral-soft', sunny: 'bg-sunny-soft', pink: 'bg-coral-soft', slate: 'bg-muted',
};

export const subjectLabel = (name: { en?: string; ar?: string } | undefined, locale: string) => (locale === 'ar' ? name?.ar || name?.en : name?.en) ?? '';

export function SubjectChip({ name, color, locale, className }: { name: { en?: string; ar?: string }; color: string; locale: string; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-foreground', BG[color] ?? BG.slate, className)}>{subjectLabel(name, locale)}</span>;
}
```

Theme tokens that exist: `bg-{violet,sky,mint,green,coral,sunny}-soft` (see `apps/web/src/app/globals.css`).

- [ ] **Step 3:** `subject-form.tsx` — a `<form>` with name `Input`, color swatches (`SUBJECT_COLORS` from `@tajriba/shared`) as round toggle buttons, icon select (`SUBJECT_ICONS`, render with lucide icons map: triangle→Triangle, zap→Zap, flask→FlaskConical, leaf→Leaf, landmark→Landmark, languages→Languages, book→BookOpen, globe→Globe, music→Music, palette→Palette, cpu→Cpu, dumbbell→Dumbbell); props `{ initial?: { name: string; color: string; icon: string }; busy: boolean; onSubmit(v): void; onCancel?(): void }`; `data-testid="subject-form"`, name input `data-testid="subject-name"`, submit `data-testid="subject-save"`.

- [ ] **Step 4:** `app/director/subjects/page.tsx` — `'use client'`; `const schoolId = useSchoolId(); const q = useApi<SchoolSubject[]>(schoolId ? `/schools/${schoolId}/subjects` : null);` Layout: `PageHeader` + `Card` with `SubjectForm` for adding (on submit `api('/schools/'+schoolId+'/subjects', { body })`, then `q.refetch()`, toast); list rows (`data-testid="subject-row"`) showing chip, counts (`t('classes', {n})`, `t('teachers', {n})`), Edit (inline `SubjectForm` with `initial`, PATCH), Delete (disabled + `title={t('deleteBlocked')}` when `classCount > 0`; DELETE then refetch). Show `ApiError.message` in the toast on failure. Empty state uses `t('empty')`. Loading → `PageSkeleton`.

- [ ] **Step 5:** Director nav: add `{ href: '/director/subjects', label: t('subjects'), icon: BookOpen }` after Overview. Director home (`app/director/page.tsx`): fetch subjects with `useApi` and when `data?.length === 0` render a `Card` (`data-testid="subjects-nudge"`) with `nudgeTitle`, `nudgeBody`, and a `Link` button to `/director/subjects`.

- [ ] **Step 6: Verify** `pnpm --filter @tajriba/web typecheck && pnpm --filter @tajriba/web lint` → PASS. Run `pnpm dev`, sign in as `director` via dev login locally (`.env` has `DEV_LOGIN=true`), open `/director/subjects`, add "Robotics", rename it, delete it.

- [ ] **Step 7: Commit** `git add apps/web && git commit -m "Add the director Subjects page"`

---

### Task 6: Web — subject pickers in invite, members and onboarding

**Files:**
- Create: `apps/web/src/components/director/subject-picker.tsx`
- Modify: `apps/web/src/components/director/invite-teacher.tsx`
- Modify: `apps/web/src/components/director/member-groups.tsx` (chips + edit dialog for teachers)
- Modify: `apps/web/src/components/director/types.ts` (`Member.subjects`)
- Modify: `apps/web/src/app/director/members/page.tsx` (pass `schoolId` to `InviteTeacher`)
- Modify: `apps/web/src/app/onboarding/page.tsx` (teacher join: load subjects by code, multi-select)
- Modify: `apps/web/messages/{en,ar}/director.json`, `apps/web/messages/{en,ar}/auth.json`

**Interfaces:**
- Consumes: `SubjectChip`, `subjectLabel` (Task 5); `GET /schools/:id/subjects`; `PUT /memberships/:id/subjects`; `GET /schools/by-code/:code/subjects`; `POST /schools/join { code, role, subjectIds }`; `POST /invites { email, role, subjectIds }`.
- Produces: `<SubjectPicker options={{id,name,color?}[]} value={string[]} onChange={(ids) => void} locale />` — toggle-chip multi-select, `data-testid="subject-option"` per chip with `aria-pressed`.

- [ ] **Step 1:** i18n (en `director.members`): `"subjectsLabel": "Subjects they teach"`, `"subjectsRequired": "Choose at least one subject"`, `"noSubjectsYet": "Add your school's subjects first"`, `"editSubjects": "Edit subjects"`, `"saveSubjects": "Save"`; (en `auth`): `"teacherSubjects": "Which subjects do you teach?"`, `"findSchool": "Find my school"`. Arabic: `"المواد التي يدرّسها"`, `"اختر مادة واحدة على الأقل"`, `"أضف مواد المدرسة أولاً"`, `"تعديل المواد"`, `"حفظ"`, `"ما المواد التي تدرّسها؟"`, `"ابحث عن مدرستي"`.

- [ ] **Step 2:** `subject-picker.tsx` (client component): renders each option as a `<button type="button" aria-pressed={selected}>` styled with `SubjectChip`-like classes plus a ring when selected; toggling updates the array.

- [ ] **Step 3:** `InviteTeacher({ schoolId })`: load `useApi<SchoolSubject[]>(`/schools/${schoolId}/subjects`)`; add `SubjectPicker` under the email; if no subjects, show `noSubjectsYet` with a link to `/director/subjects` and disable submit; submit sends `{ email, role: 'TEACHER', subjectIds }`; submit disabled while `subjectIds.length === 0`; reset picker after success.

- [ ] **Step 4:** `member-groups.tsx`: for TEACHER rows render `m.subjects.map(s => <SubjectChip .../>)` under the email, plus an "Edit subjects" ghost button opening a `Dialog` (`components/ui/dialog.tsx`) with `SubjectPicker` → `api('/memberships/'+m.id+'/subjects', { method: 'PUT', body: { subjectIds } })` → `refetch()`. `MemberGroups` already gets `schoolId` — use it to load subject options. Add `subjects: { id: string; name: { en: string; ar?: string } }[]` to `Member` in `types.ts`.

- [ ] **Step 5:** Onboarding teacher join (`app/onboarding/page.tsx`, the `mode === 'join'` branch): two-step — after the code is typed, a "Find my school" button calls `GET /schools/by-code/{code}/subjects`; show school name + `SubjectPicker` (subjects may be empty → allow joining without subjects); "Join" posts `{ code, role: 'TEACHER', subjectIds }`. Student mode unchanged.

- [ ] **Step 6: Verify** `pnpm --filter @tajriba/web typecheck && pnpm --filter @tajriba/web lint` → PASS. Manually (local dev): director → Members → invite form shows subjects, Send disabled until one is chosen; teacher rows show chips; edit dialog saves. Onboarding with code `TRP-2036` → "Find my school" lists 6 subjects.

- [ ] **Step 7: Run e2e** `pnpm e2e` → PASS (fix any selector that changed in the invite card; existing e2e only checks `invite-teacher-email` / `invite-teacher` test ids — keep them).

- [ ] **Step 8: Commit** `git add apps/web && git commit -m "Pick subjects when inviting, joining and managing teachers"`

---

### Task 7: Full verification and deploy

- [ ] **Step 1:** `pnpm --filter @tajriba/shared test && pnpm --filter @tajriba/api test && pnpm typecheck` → all PASS (report counts).
- [ ] **Step 2:** `git push origin ccr-9989b182-0vtrhp` → GitHub Action "Deploy to Heroku" runs; wait with `gh run watch <id> -R RoyElHelwe/Hackathon --exit-status`.
- [ ] **Step 3:** The release phase applies the migration. Because the production demo school was seeded before this change, run the seed once so demo subjects get `schoolId`: `heroku run:detached -a tajriba-school -- bash /app/scripts/heroku-release.sh --seed` and check logs for `Seeded "Tripoli Future School"`.
- [ ] **Step 4:** Smoke: `curl -s https://tajriba.rmtekra.com/api/auth/config` → 200; open `/director/subjects` in the browser as a signed-in director.
