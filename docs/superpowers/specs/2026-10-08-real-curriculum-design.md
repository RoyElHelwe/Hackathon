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

## 2. Courses (merged sections), Classroom import, lesson sync

*Added 2026-10-08 after user feedback:* schools run many sections of the same grade+subject (Grade 6 Math A–E) with identical content. Content and gamification must live **once per course**, not per section.

**Data model**
- New `Course { id, schoolId, subjectId, gradeLevel Int, createdAt; @@unique([schoolId, subjectId, gradeLevel]) }` — e.g. "Grade 6 · Mathematics". Its display name is derived (grade + subject name), never stored.
- `Class` (= one section = one Classroom course) gains `courseId String?` (FK Course, `SetNull`) and `sectionLabel String?` ("A", "B", …). `Class.subjectId`/`gradeLevel` are kept in sync with the course.
- New `Lesson { id, courseId, fingerprint, kind (MATERIAL | ASSIGNMENT), title, description, materials Json, position Int, postedAt, archivedAt?, status (NOT_GAMIFIED | GAMIFYING | READY | FAILED), gamifyError?, contentChangedAt?, updatedAt; @@unique([courseId, fingerprint]) }`.
  `materials` = `{ type: 'drive' | 'youtube' | 'link' | 'form', id?, title, url, mimeType?, thumbnailUrl? }[]`.
- New `LessonSource { lessonId, classId, classroomItemId, classroomUrl; @@unique([classId, classroomItemId]) }` — which section posts produced the lesson.
- Permission resource `course`: target carries the course's section `classIds`; teacher may read/write if they teach any section; student/parent read if enrolled / child enrolled in any section; director/admin read/write in school.

**Smart import** (`GET /classroom/courses` + `POST /classroom/import`)
- `GET /classroom/courses` adds a `suggestion` per Classroom course: `{ subjectId | null, gradeLevel | null, sectionLabel | null, courseId | null }`, from AI task `parseCourses` — one batched call for all of the teacher's courses with the school's subject list; it reads names/sections in English, Arabic or French ("6A Math", "Grade 6 – Math – B", "رياضيات السادس ج", "Maths 6ème B"). The mock (tests) uses a deterministic heuristic (grade digits, section letter, subject-name match). `courseId` = existing Course with the same (subject, grade). Response also returns the school's `subjects` and existing `schoolCourses`.
- The import screen groups selected Classroom courses by (subject, grade) into proposed courses ("Grade 6 · Mathematics — 5 sections"); each row has subject + grade selects (pre-filled by AI) so the teacher can fix or move a section. Import is blocked until every selected row has a subject and a grade; if the school has no subjects the screen says "Ask your director to add subjects first".
- `POST /classroom/import { items: [{ courseId, subjectId, gradeLevel, sectionLabel? }] }` (the old `{ courseIds }` body still works: items are filled from the suggestions; rows without a subject+grade import without a course). Server: find-or-create the `Course` per (school, subject, grade) and attach the section; roster sync as today. Sections imported later by other teachers join the existing course automatically.
- `PATCH /classes/:id/course { subjectId, gradeLevel, sectionLabel? }` — a teacher of the section (or director) moves it to another course (find-or-create); used for legacy/unassigned sections ("Set subject & grade" prompt).
- Seed: demo classes get courses (Grade 7/8/9 · Mathematics).

**Lesson sync** (`LessonSyncService.syncCourse(courseId)`; `POST /courses/:id/sync`; also run for each course after the 10-minute roster cron)
- For every section with a `classroomCourseId`, using that section's owner credentials, list Classroom **Materials** (`courseWorkMaterials.list`) and **Assignments** (`courseWork.list`), state `PUBLISHED`.
- Skip items Tajriba itself created (coursework whose id is a `Mission.classroomCourseWorkId`, or whose materials link to `WEB_URL`).
- **Dedupe across sections**: `fingerprint = sha256(normalizedTitle + '|' + sorted material keys)` (drive id / youtube id / link url / form url; normalized title = lowercase, collapsed spaces, stripped punctuation). Same post copied to 5 sections → one Lesson with 5 `LessonSource` rows. A post in only one section still becomes a course lesson.
- Upsert lessons by (courseId, fingerprint); `position` = order of earliest `postedAt`; a lesson with no remaining sources gets `archivedAt` (never hard-deleted); a previously archived lesson that reappears is un-archived.
- Errors per section are isolated; an auth/scope error marks that section `syncError = 'RECONNECT'` and the rest continue.

**Google scopes** — add to `CLASSROOM_SCOPES`: `classroom.courseworkmaterials.readonly` and `drive.readonly` (Drive is used by Phase 3 to read lesson files; asked now so teachers reconnect once). A Google `403` with insufficient scopes is treated like `ClassroomAuthError` (reconnect banner).

**Web**
- Import step: grouped picker as above.
- Teacher home: classes grouped under their course ("Grade 6 · Mathematics · 5 sections" with section cards and a "Lessons" button); unassigned sections listed separately with "Set subject & grade".
- New course page `/teacher/courses/[id]`: header (subject chip, grade, section chips linking to class pages), **Lessons** list (ordered; title, kind, attachment icons — PDF/Doc/Slides/Sheet/video/link/form, sections count "Posted in 5 sections", status badge, "Open in Classroom"), **Sync lessons** button, empty state "Post lessons in Google Classroom, then press Sync".
- Class page: header shows its course (link) or a "Set subject & grade" button (dialog with subject + grade selects).

## 3. "Gamify this lesson"

`POST /lessons/:id/gamify` (teacher of any section of the lesson's course). Skills and missions belong to the **course**: every section's students see them.

1. Set `status = GAMIFYING` (reject if already gamifying).
2. **Collect content** (`LessonContentService`): Drive files via Drive API — Google Docs/Slides exported as `text/plain`, PDFs downloaded (≤ 15 MB) and text-extracted with `unpdf`; YouTube → title + Classroom description; links → title + URL; forms ignored. Concatenate with headers, cap at 40 000 chars. Fake provider returns fixture text.
3. **AI task `gamifyLesson`** (model `AI_MODEL_FAST`, JSON validated by zod) input: subject name, class grade, lesson title/description, content, school city, locale; output: `{ skill: { name: {en, ar}, description: {en, ar}, icon }, missions: GeneratedMission[] (1–3) }` — `GeneratedMission` reuses the existing `generateMissions` output schema. Student names never sent (none present). Mock AI returns a deterministic fixture.
4. **Persist** (transaction): create or update `Topic { subjectId: course.subjectId, courseId, lessonId, key: 'l_<lessonId>', gradeLevel: course.gradeLevel, posX/posY by position }`; prerequisite = topic of the nearest earlier `READY` lesson in the same course; create missions as `DRAFT` (`aiGenerated: true`, `courseId`, `classId = null`); approving a course mission notifies students of all sections and (optionally) publishes it to every section's Classroom; grade passback uses the student's own section and run the existing safety prefilter + AI safety check; `status = READY`, `topicId` set.
5. Failure → `status = FAILED`, `gamifyError` = friendly message; content is kept for retry.
- **Regenerate**: same endpoint on a `READY` lesson — updates the skill text, deletes this lesson's `DRAFT` missions only, adds new drafts; approved/archived missions untouched.
- `Topic` gains `courseId String?` and `lessonId String? @unique`; `Mission` gains `courseId String?`; a mission is visible to students enrolled in any section of its course.

## 4. Real data everywhere

A single server helper `CurriculumService` decides visibility:
- `classTopics(classId)` = topics of the section's course (`courseId = class.courseId`) **plus** legacy topics (`courseId = null`) of `class.subjectId` — never a math fallback. Empty → `[]`. The heatmap rows stay the section's own students.
- `studentTopics(studentId)` = union of `classTopics` over the student's ACTIVE enrollments; `studentSubjects` = their subjects.

Consumers switched to it: teacher dashboard (`dashboards.service.ts` heatmap, avg mastery, stuck, director per-class mastery), Mission Studio topic picker, `GET /subjects` + `GET /subjects/:key/graph` (nodes limited to the student's visible topics when the actor is a student/parent-of-student), parent skill path (subject tabs instead of hardwired math), teacher student skill tiles, director coverage (school subjects only).

Web: remove `'math'` defaults (first available subject), subject colors/icons read from the API (`color`, `icon` fields) with the existing style map as fallback for legacy keys; sort orders use `Subject.name` instead of fixed key arrays; empty states — class: "Gamify a lesson to see mastery here"; student map: "Ask your teacher to add you in Google Classroom".

Demo school: seed assigns its subjects to the school and sets `Class.subjectId` for the seeded classes, so the golden path is unchanged.

## Testing

- Shared unit: permission rules for `subject`, `lesson`.
- API integration (real Postgres, mock AI, fake Classroom): subjects CRUD + delete-409; invite requires subjects for teachers and creates `TeacherSubject` on accept; import classifies subject; lesson sync upsert/archive/order; gamify creates topic + prerequisite + draft missions, regenerate keeps approved missions, failure path; student map/heatmap scoping (student in Physics class sees only Physics skills; no math fallback).
- Existing 36 tests and e2e golden path stay green.

## Delivery order (deploy after each)

1. Subjects + invites (done). 2. Courses + smart import + lesson sync. 3. Gamify button (course-level). 4. Real-data scoping + director coverage page.
