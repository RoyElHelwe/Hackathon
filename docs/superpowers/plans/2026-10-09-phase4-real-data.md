# Phase 4 — Real data everywhere (+ director Coverage page)

**Spec:** `docs/superpowers/specs/2026-10-08-real-curriculum-design.md` §4 (read §2–§3 for Course/Lesson/Topic/Mission-template context). Speed over ceremony: a few integration tests, typecheck, lint.

## Goal
Every screen shows only the school's real courses, subjects and lesson skills. No hardcoded `'math'` fallback or fixed subject order anywhere. The demo school keeps working.

## Decisions already made (follow them)

### `CurriculumService` (apps/api/src/courses/curriculum.service.ts, exported)
- `classTopicIds(classId)` / `classTopics(classId)`: topics with `courseId = class.courseId` (when set) **plus** legacy topics (`courseId = null`) of `class.subjectId` that have at least one mission in this class OR are prerequisites of such topics (so the demo geometry map stays intact) — never a math fallback. No subject → `[]`.
  - Simpler acceptable rule if the "prerequisite closure" is awkward: legacy topics of `class.subjectId` (all of them) — the demo school only has legacy topics in Math, so this keeps the golden path.
- `studentTopics(studentId)`: union of `classTopics` over the student's ACTIVE enrollments; `studentSubjects(studentId)`: distinct subjects of those topics' subjects / their classes' subjects (with id, key, name, color, icon).
- `schoolCourses(schoolId)` for the director.

### Consumers to switch (grep for `'math'`, `SUBJECT_ORDER`, `order.indexOf`, `subject.key ===`, `findUnique({ where: { key } })` on subject)
- `dashboards.service.ts`: teacher dashboard `classTopics` → CurriculumService (heatmap columns, avg mastery, stuck); director per-class avgMastery; director coverage endpoint → school subjects/courses only (rows = courses or classes, columns = their topics), no global topics. Return `color`/`icon`/`subjectName` with topics so the web needs no key-based maps.
- `subjects.service.ts`: `list(a)` — STUDENT: subjects of their ACTIVE classes; PARENT: subjects of children's classes; TEACHER/ADMIN/DIRECTOR: school subjects that have ≥1 topic visible in their classes (teacher) / in the school (director). Include `topicCount` of *visible* topics only. `GET /subjects/:key/graph?studentId=`: look up the subject within the actor's school (404 otherwise); nodes = the target student's visible topics in that subject (`studentTopics`), edges only between visible nodes; keep existing mission/progress logic.
- `progress/stuck.service.ts`, `gamification` profile, parent dashboards: anything that iterates "all topics" should use visible topics (check and fix; skip if already scoped by missions).
- Mission studio class mode topic picker: use the class's topics (from dashboard) — already the case if dashboard is fixed; remove the `'math'` default.

### Web
- Remove `'math'` defaults: `app/student/map/page.tsx` (default = first subject), `app/teacher/missions/page.tsx`, `components/teacher/skill-tiles.tsx`, `components/parent/skill-path.tsx` (make it subject tabs from `/subjects` like the student map instead of hardwired `/subjects/math/graph`).
- Subject style: `components/student/subject-style.ts` — derive colors from the API `color` (violet/sky/mint/green/coral/sunny/pink/slate) with the existing map only as fallback; icons from API `icon` (lucide map shared with `components/director/subject-form.tsx` — extract a small `components/app/subject-icon.tsx` used by both) ; topic icons: keep `TOPIC_EMOJI` for legacy keys, otherwise map the AI `icon` string to a lucide icon with a star fallback.
- Sorting: by localized subject name, not fixed key arrays (`components/teacher/helpers.ts` `SUBJECT_ORDER`, heatmap).
- Empty states (en + ar): teacher class heatmap "No skills yet — open the course and gamify a lesson" with a link to the course page; student map "Ask your teacher to add you in Google Classroom" when no classes, "Your teachers haven't published skills yet" when classes but no topics; parent skill path similar.
- **Director Coverage page** (`app/director/coverage/page.tsx` — the nav already links to it and it currently 404s): grid per course (rows = sections, columns = course skills, cell = % of section students who mastered) using the existing `components/director/coverage-matrix.tsx` if it fits the data, plus empty state "No skills yet — teachers gamify lessons from their courses".
- Student map node visuals: lesson skills (key starts with `l_`) render with their icon and name; layout uses `posX/posY` as today.

## Tests (light)
`apps/api/test/real-data.spec.ts`: (1) a student only in a gamified Physics course (create subject Physics + course + section via import with items, sync, gamify via `LessonGamifyService.run`, approve) sees only Physics in `GET /subjects` and only that course's skill nodes in `/subjects/<physicsKey>/graph`; (2) the teacher dashboard for that section has heatmap topics = the course skill(s), and a section with no subject returns `topics: []` (no math fallback); (3) demo golden path: Lea still sees the Math geometry map (existing golden-loop test must stay green); (4) director coverage returns only the school's courses. Full suite once.
