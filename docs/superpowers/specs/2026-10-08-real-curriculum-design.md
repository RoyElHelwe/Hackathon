# Real curriculum: school subjects, Classroom lessons, AI gamification

Status: approved 2026-10-08 · Builds on CLAUDE.md (product spec) and DECISIONS.md.

## Goal

Replace the seeded, global demo curriculum with each school's real data:

1. The director defines the school's **subjects**; every teacher invite names at least one subject.
2. A teacher imports Google Classroom courses; **AI assigns each class a subject**.
3. Teachers keep posting lessons **in Google Classroom**; Tajriba **syncs** them (materials, PDFs, Docs, Slides, videos, links).
4. Each lesson has a **"Gamify with AI"** button: AI reads the content and creates **one skill** on the class's map plus **1–3 draft missions**.
5. Class details (heatmap, mastery, stuck alerts) and the **student skill map** show only real classes and their skills.
6. Students join their classes **automatically from the teacher's Classroom roster** (no student Classroom permission).

Non-goals: student-side Classroom OAuth; YouTube transcripts (not available to apps); manual mission authoring; publishing the Google OAuth app.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Foundation | Extend existing models (Subject/Topic/Mission/TopicProgress) — gamification, XP, peer review keep working unchanged. |
| Lesson → map | One skill (Topic) per gamified lesson; unlock order = Classroom post order. |
| Student join | Automatic from teacher-imported rosters (existing `syncClass` behavior). |
| Safety | AI missions stay `DRAFT` until the teacher approves (existing rule). |

## 1. School subjects and teacher invites

**Data model**
- `Subject.schoolId String?` (FK School, cascade). `null` = legacy global subject. Seeded demo subjects are assigned to the demo school. `key` stays globally unique; new subjects get generated keys (`s_<cuid>`).
- `Subject.archived Boolean @default(false)` is not needed — delete is blocked while a Class uses the subject.
- New `TeacherSubject { teacherId, schoolId, subjectId, @@id([teacherId, subjectId]) }`.
- `Invite.subjectIds String[] @default([])`.
- `Membership`-join for teachers by school code accepts optional `subjectIds`, stored as `TeacherSubject` rows on approval (rows are created at join with the PENDING membership; they only matter once approved).

**API** (`schools` module, permission resource `subject`: director/admin read+write, teacher/student/parent read)
- `GET /schools/:id/subjects` — subjects with `classCount`, `teacherCount`.
- `POST /schools/:id/subjects` `{ name, color?, icon? }` — the AI translation task fills the other locale (`name: { en, ar }`); mock AI returns the same text for both.
- `PATCH /schools/:id/subjects/:subjectId` `{ name?, color?, icon? }`.
- `DELETE /schools/:id/subjects/:subjectId` — `409` if any class uses it.
- `POST /invites` — `subjectIds` required (≥1) when `role = TEACHER`; every id must belong to the school.
- Accepting an invite creates `TeacherSubject` rows.
- `PUT /memberships/:id/subjects { subjectIds }` — director/admin edits a teacher's subjects.
- `GET /subjects` (existing) returns subjects of the actor's active school (plus legacy global ones only for schools that have no own subjects — keeps old data readable).

**Web**
- Director → new **Subjects** page (`/director/subjects`), linked from the director nav: list, add (name + color swatch + icon), rename, delete (disabled with tooltip while classes use it). Director home shows a nudge card when the school has 0 subjects.
- Invite-teacher form: subject multi-select (chips); Send disabled until ≥1 chosen.
- Members page: teacher rows show subject chips with an edit dialog.
- Onboarding "I'm a teacher" join form: subject multi-select (from `GET /schools/by-code/:code/subjects`, public, returns names only).

## 2. Classroom import, AI subject detection, lesson sync

**Data model**
- `Class.subjectId String?` (FK Subject, `SetNull`).
- New `Lesson`:
  `id, classId, classroomItemId (unique per class), kind (MATERIAL | ASSIGNMENT), title, description, materials Json, position Int, classroomUrl, postedAt, archivedAt?, status (NOT_GAMIFIED | GAMIFYING | READY | FAILED), gamifyError?, topicId? (unique), updatedAt`.
  `materials` = array of `{ type: 'drive' | 'youtube' | 'link' | 'form', id?, title, url, mimeType?, thumbnailUrl? }`.

**Import** (`ClassroomService.importCourse`)
- After creating the Class, run AI task `classifySubject({ courseName, section, description, candidates: [{id, name}] })` → `{ subjectId | null, confidence }`. Candidates = teacher's subjects, else all school subjects. Accept when `confidence ≥ 0.6`; otherwise leave `subjectId = null`.
- If the school has no subjects, skip AI; class stays unassigned.
- `PATCH /classes/:id { subjectId }` — teacher of the class (or director) sets/overrides it.

**Lesson sync** (`ClassroomService.syncLessons`, called from `syncClass`)
- Provider gains `listLessons(t, courseId)` → normalized items from `courses.courseWorkMaterials.list` and `courses.courseWork.list` (status `PUBLISHED`).
- Upsert by `(classId, classroomItemId)`; `position` = order by Classroom `creationTime` ascending; items no longer returned get `archivedAt` set (never hard-deleted).
- If title/description/materials change on a `READY` lesson, keep the skill; set a `contentChangedAt` hint shown as "Updated in Classroom — regenerate?".
- Fake provider: fixture lessons for the fixture courses (a PDF-like drive file, a YouTube video, a link).

**Google scopes** — add to `CLASSROOM_SCOPES`: `classroom.courseworkmaterials.readonly`, `drive.readonly`. (Announcements are out of scope — they rarely carry lessons and would add another scope.) Teachers who connected before see the existing reconnect banner when a call returns insufficient-scope (`403 ACCESS_TOKEN_SCOPE_INSUFFICIENT`), treated like `ClassroomAuthError`.

**Web** — Class page gets a **Lessons** tab: ordered list, attachment icons (PDF/Doc/Slides/video/link), status badge, "Open in Classroom", "Gamify with AI" / "Regenerate" button, and a subject dropdown in the class header ("Choose subject" warning when null).

## 3. "Gamify this lesson"

`POST /lessons/:id/gamify` (teacher of the class). Requires `class.subjectId` (else `409 "Choose this class's subject first"`).

1. Set `status = GAMIFYING` (reject if already gamifying).
2. **Collect content** (`LessonContentService`): Drive files via Drive API — Google Docs/Slides exported as `text/plain`, PDFs downloaded (≤ 15 MB) and text-extracted with `unpdf`; YouTube → title + Classroom description; links → title + URL; forms ignored. Concatenate with headers, cap at 40 000 chars. Fake provider returns fixture text.
3. **AI task `gamifyLesson`** (model `AI_MODEL_FAST`, JSON validated by zod) input: subject name, class grade, lesson title/description, content, school city, locale; output: `{ skill: { name: {en, ar}, description: {en, ar}, icon }, missions: GeneratedMission[] (1–3) }` — `GeneratedMission` reuses the existing `generateMissions` output schema. Student names never sent (none present). Mock AI returns a deterministic fixture.
4. **Persist** (transaction): create or update `Topic { subjectId: class.subjectId, classId, lessonId, key: 'l_<lessonId>', gradeLevel: class.gradeLevel ?? 8, posX/posY by position }`; prerequisite = topic of the nearest earlier `READY` lesson in the same class; create missions as `DRAFT` (`aiGenerated: true`, `classId`) and run the existing safety prefilter + AI safety check; `status = READY`, `topicId` set.
5. Failure → `status = FAILED`, `gamifyError` = friendly message; content is kept for retry.
- **Regenerate**: same endpoint on a `READY` lesson — updates the skill text, deletes this lesson's `DRAFT` missions only, adds new drafts; approved/archived missions untouched.
- `Topic` gains `classId String?` and `lessonId String? @unique`.

## 4. Real data everywhere

A single server helper `CurriculumService` decides visibility:
- `classTopics(classId)` = topics with `classId = class.id` **plus** legacy topics (`classId = null`) of `class.subjectId` — never a math fallback. Empty → `[]`.
- `studentTopics(studentId)` = union of `classTopics` over the student's ACTIVE enrollments; `studentSubjects` = their subjects.

Consumers switched to it: teacher dashboard (`dashboards.service.ts` heatmap, avg mastery, stuck, director per-class mastery), Mission Studio topic picker, `GET /subjects` + `GET /subjects/:key/graph` (nodes limited to the student's visible topics when the actor is a student/parent-of-student), parent skill path (subject tabs instead of hardwired math), teacher student skill tiles, director coverage (school subjects only).

Web: remove `'math'` defaults (first available subject), subject colors/icons read from the API (`color`, `icon` fields) with the existing style map as fallback for legacy keys; sort orders use `Subject.name` instead of fixed key arrays; empty states — class: "Gamify a lesson to see mastery here"; student map: "Ask your teacher to add you in Google Classroom".

Demo school: seed assigns its subjects to the school and sets `Class.subjectId` for the seeded classes, so the golden path is unchanged.

## Testing

- Shared unit: permission rules for `subject`, `lesson`.
- API integration (real Postgres, mock AI, fake Classroom): subjects CRUD + delete-409; invite requires subjects for teachers and creates `TeacherSubject` on accept; import classifies subject; lesson sync upsert/archive/order; gamify creates topic + prerequisite + draft missions, regenerate keeps approved missions, failure path; student map/heatmap scoping (student in Physics class sees only Physics skills; no math fallback).
- Existing 36 tests and e2e golden path stay green.

## Delivery order (deploy after each)

1. Subjects + invites. 2. Import classification + lesson sync. 3. Gamify button. 4. Real-data scoping.
