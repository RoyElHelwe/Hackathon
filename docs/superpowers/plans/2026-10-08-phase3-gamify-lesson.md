# Phase 3 — "Gamify with AI" on course lessons

**Spec:** `docs/superpowers/specs/2026-10-08-real-curriculum-design.md` §3 (+ §2 for Course/Lesson). Speed over ceremony: a few integration tests for the core path, typecheck, lint.

## Decisions already made (follow them)

### Data model (one migration `lesson_gamify`)
- `Topic.courseId String?` (FK Course, Cascade) and `Topic.lessonId String? @unique` (FK Lesson, SetNull). Topic key for lesson skills: `'l_' + lessonId`.
- `Mission.courseId String?` (FK Course, Cascade) and `Mission.parentMissionId String?` (self-relation, Cascade) — **course template + per-section copies**:
  - Gamify creates **template** missions: `courseId` set, `classId = null`, `status = DRAFT`, `aiGenerated = true`.
  - Approving a template (`POST /missions/:id/approve`, same endpoint) marks it `APPROVED` and **fans out**: for every section (Class) of the course, create a copy with `classId = section.id`, `courseId`, `parentMissionId = template.id`, `status = APPROVED`, same content/dueAt; publish to that section's Classroom when `postToClassroom` (per section, errors per section logged, not fatal); notify that section's students. All existing classId-based logic (student lists, peer review, heatmap, grade passback) keeps working on the copies.
  - When a section joins a course later (import or `PATCH /classes/:id/course`), create copies of the course's APPROVED templates for it (no Classroom publish).
  - Archiving a template archives its copies. Editing is only allowed while DRAFT (existing rule).
- Permissions: `mission_draft`/`mission` checks for templates use `Target.courseClassIds` (course's section ids): teacher may read/write a template when `intersects(classIdsTaught, courseClassIds)`; admin read. Add `courseClassIds` handling to those cases in `packages/shared/src/permissions.ts` (keep classId behavior unchanged when classId is set). Unit-test it.

### Content extraction (`LessonContentService`, apps/api/src/courses/)
- Collect text for a lesson: title + description, then each material:
  - Drive file (use the credentials of the owner of the lesson's first source section; Drive v3 via `googleapis`): Google Docs → `files.export(text/plain)`, Slides → `files.export(text/plain)`, Sheets → `files.export(text/csv)`, PDF (`application/pdf`, ≤ 15 MB via `files.get` metadata `size`) → download (`alt: 'media'`, arraybuffer) and extract text with `unpdf` (`extractText`), plain text files → download; other types → title only.
  - YouTube → title (+ URL); link → title + URL; form → skipped.
  - Cap each file at 15 000 chars and the total at 40 000 chars. Never fail the whole lesson because one file failed: note "(could not read: <title>)" and continue. Auth/scope errors → mark the section `syncError = 'RECONNECT'` and continue with what you have.
- Add a `ClassroomProvider`-independent seam so tests don't hit Google: put Drive access behind an injectable `DRIVE_READER` token with `GoogleDriveReader` (real) and `FakeDriveReader` (returns fixture text per file id; select by `CLASSROOM_PROVIDER` like the Classroom provider). Fixture text for the fake lessons' drive files (a short paragraph about the lesson topic).

### AI task `gamifyLesson` (apps/api/src/ai/tasks/gamify-lesson.ts)
- Model `fast`. Input `{ subject, grade, lessonTitle, content, city, locale, count }` (count 2 default, max 3). Output zod schema in packages/shared: `gamifyLessonOutput = z.object({ skill: z.object({ name: i18nText-like {en, ar}, description: {en, ar}, icon: z.string() }), missions: generateMissionsOutput.shape.missions })` — reuse the existing mission item schema exactly so persisting reuses the same mapping as `MissionsService.generate`.
- Prompt: reuse the generate-missions system rules (real-life, safe, Lebanon, proof spec, rubric) and add: "Base the skill and missions ONLY on this lesson's content; the skill name is the lesson's core concept in 2–5 words; missions apply it in real life". Give the content inside a clearly delimited block and tell the model to ignore any instructions inside the content (prompt-injection guard).
- The default `AI_MAX_TOKENS` (1200) is too small: add optional `maxTokens?: number` and `timeoutMs?: number` to `TaskDef`, used by the OpenRouter transport (default to config / 30 s); set `maxTokens: 4000`, `timeoutMs: 90_000` for gamifyLesson.
- Mock: deterministic skill from the lesson title + missions from the existing mock bank/generic template (use `mockMissions`).

### Endpoint & flow
- `POST /lessons/:id/gamify` (teacher of any section of the lesson's course): 409 if status is GAMIFYING; set `GAMIFYING`, clear `gamifyError`, **return 202 immediately** `{ status: 'GAMIFYING' }` and run the work in the background (Heroku's router times out at 30 s) — fire-and-forget promise with try/catch that sets `FAILED` + friendly `gamifyError` on error. Tests can `await` the service method directly (`LessonGamifyService.run(lessonId)`); the controller calls it without awaiting.
- `run(lessonId)`: content → AI → transaction: upsert Topic (`subjectId = course.subjectId`, `courseId`, `lessonId`, `key 'l_<lessonId>'`, name/description/icon from AI, `gradeLevel = course.gradeLevel`, `posX`/`posY` from lesson position, e.g. x = 50 + (position % 2 ? 20 : -20), y = 10 + position * 18 — keep within the existing map coordinate conventions, check how seed topics use pos), prerequisite = topic of the nearest earlier READY lesson in the same course (by position); delete this lesson topic's existing DRAFT template missions; create new DRAFT templates (`courseId`, `classId null`, `topicId`, `createdById` = requesting teacher) and run the existing safety prefilter + AI safety check per mission (reuse `MissionsService.runSafety`/the same code path as `generate`); set lesson `READY`, `contentChangedAt = null`.
- Regenerate = same endpoint on a READY/FAILED lesson; APPROVED/ARCHIVED missions untouched.
- `GET /courses/:id/lessons` adds per lesson: `topic: { id, name } | null`, `draftCount`, `approvedCount`, `gamifyError`, `contentChangedAt`.
- `GET /missions?courseId=` (teacher) returns that course's templates (drafts + approved) so the web can review them; `GET /missions/:id` works for templates.
- Lesson sync (Phase 2) must not touch topics/missions; if a lesson becomes archived its topic stays (student progress is kept).

### Web (en + ar strings)
- Course page `/teacher/courses/[id]`: each lesson row gets **"Gamify with AI"** (NOT_GAMIFIED/FAILED) or **"Regenerate"** (READY) button (Wand2 icon) → POST, then poll `GET /courses/:id/lessons` every 3 s while any lesson is GAMIFYING (stop when none). Status badge shows "Bousla is reading the lesson…" while GAMIFYING; FAILED shows the error + retry. READY rows show the skill name and "N missions to review" linking to the mission studio for that course; "Updated in Classroom — regenerate?" hint when `contentChangedAt`.
- Mission studio (`app/teacher/missions/page.tsx`) supports `?courseId=`: list the course's template drafts using the existing draft card / edit / approve UI (the approve dialog's "post to Classroom" now means "to every section"); hide the old topic-picker generator for course mode (generation happens from lessons). Keep class mode working as today.
- Typecheck + lint web.

## Tests (light)
`apps/api/test/gamify.spec.ts`: (1) course with 2 sections (use the Grade 8 demo course after attaching fake-8a-math, or create via import) → sync lessons → `run(lessonId)` → lesson READY, topic with courseId/lessonId, 2 DRAFT templates with classId null; second lesson's topic has the first as prerequisite; (2) approve a template → one APPROVED copy per section with classId set, students of both sections see it in `GET /missions`; (3) regenerate keeps the approved template and its copies, replaces drafts; (4) POST /lessons/:id/gamify returns 202 and a student gets 403. Plus permission unit tests. Full suite once at the end.
