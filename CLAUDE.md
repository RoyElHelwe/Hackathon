# TAJRIBA (تجربة) — Build Spec for Claude Code

> Save this file as `CLAUDE.md` at the repo root. It is the single source of truth.
> Build phase by phase (section 16). Do not start a phase until the previous phase's tests pass.

---

## 0. Mission

You are a senior full-stack engineer building **Tajriba**, a hackathon product for the **Experia Education Hackathon** (Beirut, Oct 8–10, 2026). Topic: **"The School of 2036"** — rethink school, don't just improve it.

**One line:** students learn any school subject through **real-life missions**, level up like a **game**, and **evaluate each other like 42 School**. Teachers guide, parents take part, schools see real learning. AI is the coach for everyone.

**Scope:** the system is subject-agnostic (math, physics, chemistry, history, languages…). **The demo content is geometry**, plus 2 bonus missions from other subjects to prove it generalizes.

**Deliverables judged:** a working prototype shown in a **recorded video (max 5 min)** + a **PDF**. No live pitch. Every demo flow must work reliably and look polished on camera.

**Judging weights:** Technical quality & functionality 40% · Problem relevance 20% · Innovation & future thinking 20% · Feasibility & scalability 10% · Pitch & demo 10% · +5% if submitted before Saturday 3:00 PM.

**Priorities, in order:** (1) the golden demo path works end-to-end, (2) it looks amazing, (3) everything else.

---

## 1. Tech stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | **Next.js** (App Router, TypeScript), **PWA** via `@serwist/next` |
| UI | Tailwind CSS + shadcn/ui (teacher/parent/director) + custom kid components (student) |
| Animation | `motion` (Framer Motion), `canvas-confetti` |
| Skill graph | `@xyflow/react` |
| Charts | `recharts` |
| i18n | `next-intl` — English + Arabic (RTL). French optional |
| Backend | **NestJS** (TypeScript) |
| DB | **PostgreSQL** + **Prisma 7** (use `prisma.config.ts` and the `@prisma/adapter-pg` driver adapter, per Prisma 7 conventions — check current Prisma 7 docs, don't guess) |
| Auth | Google OAuth (`passport-google-oauth20`) + JWT in httpOnly cookie |
| Google | `googleapis` — Classroom API only |
| AI | **OpenRouter** (OpenAI-compatible API) |
| Scheduling | `@nestjs/schedule` |
| Validation | `zod` (shared schemas) + NestJS pipes |
| Files | Local disk `./uploads`, served only through authenticated endpoints |
| Tests | Jest + Supertest (API), Playwright (E2E) |
| Infra | Docker Compose (Postgres, plus the apps for "one command" runs) |

Before using any library API, check the docs for the installed version instead of guessing.

### Repo layout
```
tajriba/
  apps/
    web/            Next.js PWA (all roles)
    api/            NestJS API
  packages/
    shared/         zod schemas, enums, types, XP/level math, permission helpers, state machine
  e2e/              Playwright tests
  docker-compose.yml
  .env.example
  CLAUDE.md
  DECISIONS.md
```

### Environment (`.env.example`)
```
# Core
DATABASE_URL=postgresql://tajriba:tajriba@localhost:5432/tajriba
API_URL=http://localhost:4000
WEB_URL=http://localhost:3000
JWT_SECRET=change-me
TOKEN_ENCRYPTION_KEY=change-me-32-bytes-base64
UPLOAD_DIR=./uploads

# Google OAuth + Classroom
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
CLASSROOM_PROVIDER=google        # google | fake  (fake = seeded fixtures, used in tests and as demo fallback)

# AI (OpenRouter)
AI_PROVIDER=openrouter           # openrouter | mock  (mock = deterministic fixtures for tests)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL_VISION=                 # a vision-capable model for checking photo submissions (verify current IDs on openrouter.ai/models)
AI_MODEL_FAST=                   # a cheap fast model for hints, sheets, summaries
AI_MAX_TOKENS=1200
AI_CACHE=true                    # cache identical AI requests in DB (saves credit, stabilizes demo)

# Demo
DEV_LOGIN=true                   # enables /auth/dev?as=<handle> one-click login. MUST be false in production
```
Never commit `.env`. Never log tokens or API keys. Set a spending limit on the OpenRouter key.

---

## 2. Roles and the "pyramid"

```
School (tenant)
 └─ Director / Admin      creates school, invites & approves teachers
     └─ Teachers          join with school code; import classes from Classroom
         └─ Classes       1:1 with a Google Classroom course
             └─ Students  auto-linked by Google ID from the Classroom roster
                 └─ Parents   linked to children via family code or invite
```

### The 3 golden rules (prevent all conflicts)
1. **One person = one `User`**, identified by Google account ID (`googleId`, unique). Never create a person twice.
2. **Roles live on `Membership`, not on `User`.** A teacher who is also a parent = one user, two memberships, role switcher in the UI.
3. **Single owner per data type:**
   - **Google Classroom owns rosters** (who is in which class). Tajriba only reads them.
   - **Tajriba owns** everything else: missions, submissions, XP, peer evaluations, parent links, school settings.

### Role summary
| Role | Can |
|---|---|
| DIRECTOR | Everything in their school: approve/remove members, school dashboard, settings |
| ADMIN | Same as director except deleting the school |
| TEACHER | Own classes only: import, missions, reviews, heatmap, invite parents |
| STUDENT | Own progress, missions, submissions; peer-evaluate assigned submissions |
| PARENT | Linked children only: progress, summaries, family missions, message the teacher |

---

## 3. Onboarding flows (implement exactly)

### 3.1 Director
1. Signs in with Google (basic scopes: `openid email profile`).
2. "Create your school" → name, city, grade levels → creates `School` with a unique `schoolCode` (format `TRP-4821`: 3 letters from city + 4 digits).
3. Becomes `Membership(role=DIRECTOR, status=APPROVED)`.
4. Can invite teachers by email (creates `Invite`) or share the school code.

### 3.2 Teacher
1. Signs in with Google → "Join a school" → enters the school code **or** opens an invite link.
   - Code join → `Membership(TEACHER, PENDING)` until a director/admin approves.
   - Invite link → `Membership(TEACHER, APPROVED)` immediately.
2. "Connect Google Classroom" → incremental OAuth with offline access and scopes:
   - `classroom.courses.readonly`
   - `classroom.rosters.readonly`
   - `classroom.profile.emails`
   - `classroom.coursework.students`
3. "Import classes" → `courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] })` → teacher selects → for each course:
   - If `classroomCourseId` already exists → add this teacher as `ClassTeacher(CO_TEACHER)`. Never duplicate the class.
   - Else create `Class` + `ClassTeacher(OWNER)`.
   - Import the roster with `courses.students.list` and `courses.teachers.list`:
     - Match by `googleId` (Classroom `userId` = Google account ID); fallback match by email.
     - Unknown students → create `User(status=INVITED)` + `Membership(STUDENT, APPROVED)` + `Enrollment(ACTIVE)`.
4. Success screen "Imported 24 students into 8B Math" with confetti.

### 3.3 Student — zero setup
1. Signs in with Google → `googleId` matches the INVITED user → status becomes ACTIVE → lands on home with their classes already there.
2. No match: friendly screen "Ask your teacher to add you in Google Classroom" + "I have a school code" option (creates a PENDING membership; a teacher approves).

### 3.4 Parent
- **Family code (primary, demo path):** student opens Profile → "Invite my family" → 6-digit code valid 24h (`FamilyCode`). Parent signs in with Google → "Link my child" → enters code → `ParentLink(VERIFIED, method=FAMILY_CODE)` + `Membership(PARENT, APPROVED)` in the child's school.
- **Teacher invite:** teacher enters a parent email on a student page → `Invite` → parent signs in via the link → linked.
- Roadmap only: the Classroom guardians API, for schools that enable it.

### 3.5 Roster sync
- Cron every 10 minutes + "Sync now" button per class.
- New students → added. Removed students → `Enrollment.status = ARCHIVED` (never delete; keep XP and history).
- Sync failures (expired token, revoked access) → banner on the teacher dashboard: "Reconnect Google Classroom".

### 3.6 Conflict rules (each must be covered by a test)
| Situation | Behavior |
|---|---|
| Same Classroom course imported by two teachers | One `Class`; the second teacher = CO_TEACHER |
| Student in many classes | One user, many enrollments |
| Parent with several children | One user, many `ParentLink`s, child switcher |
| User with two roles | One user, two memberships, role switcher |
| Student removed from Classroom | Enrollment archived; progress kept |
| Student changes class | Progress is per student × topic, not per class → nothing lost |
| Wrong school join | Stays PENDING; director can reject |
| Family code reused or expired | Rejected with a friendly message |
| Duplicate Google login | Impossible: `googleId` unique |

---

## 4. Permissions (enforce in the API, mirror in the UI)

Implement a NestJS `PolicyGuard` + `@Can(action, resource)` decorator. Every endpoint declares its policy. **Default deny.**

| Resource | Director/Admin | Teacher | Student | Parent |
|---|---|---|---|---|
| School settings & members | read/write | read own membership | — | — |
| Class | all in school | classes they teach | classes enrolled | children's classes (read) |
| Mission (draft) | read | write in own classes | — | — |
| Mission (approved) | read | write in own classes | read if enrolled | read family missions |
| Submission | read all | read/review in own classes | own + **assigned peer reviews only** | children's (read) |
| Progress / XP | all | own classes | own | children's |
| Peer evaluation | read | read/override in own classes | write if assigned evaluator | — |
| Parent summary | — | — | — | own children |
| Uploads (photos/audio) | school | own classes | own + assigned reviews | children's |

Peer evaluator eligibility: same class, topic MASTERED, not the submitter, enrollment ACTIVE.

Put pure permission helpers in `packages/shared` so they're unit-testable.

---

## 5. Data model (Prisma)

```prisma
enum Role { DIRECTOR ADMIN TEACHER STUDENT PARENT }
enum MembershipStatus { PENDING APPROVED REJECTED }
enum UserStatus { INVITED ACTIVE }
enum ClassTeacherType { OWNER CO_TEACHER }
enum EnrollmentStatus { ACTIVE ARCHIVED }
enum ParentLinkStatus { PENDING VERIFIED }
enum ParentLinkMethod { FAMILY_CODE INVITE CLASSROOM }
enum MissionStatus { DRAFT APPROVED ARCHIVED }
enum MissionAudience { STUDENT FAMILY SQUAD }
enum Difficulty { EASY MEDIUM HARD }
enum SubmissionStatus {
  IN_PROGRESS SUBMITTED AI_CHECKED FOLLOW_UP_ANSWERED
  PEER_REVIEW FAMILY_CONFIRM TEACHER_REVIEW VALIDATED RETRY
}
enum MasteryState { LOCKED AVAILABLE IN_PROGRESS MASTERED }

model School {
  id          String   @id @default(cuid())
  name        String
  city        String
  schoolCode  String   @unique
  settings    Json     @default("{}")   // leaderboardEnabled, safety rules, locale
  createdAt   DateTime @default(now())
}

model User {
  id                  String     @id @default(cuid())
  googleId            String     @unique
  email               String     @unique
  name                String
  avatarUrl           String?
  locale              String     @default("en")
  status              UserStatus @default(ACTIVE)
  googleRefreshToken  String?    // encrypted at rest (AES-GCM), teachers only
  createdAt           DateTime   @default(now())
}

model Membership {
  id        String           @id @default(cuid())
  userId    String
  schoolId  String
  role      Role
  status    MembershipStatus @default(PENDING)
  createdAt DateTime         @default(now())
  @@unique([userId, schoolId, role])
}

model Invite {
  id        String   @id @default(cuid())
  schoolId  String
  email     String
  role      Role
  studentId String?  // for parent invites
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
}

model Class {
  id                String    @id @default(cuid())
  schoolId          String
  name              String
  gradeLevel        Int?
  classroomCourseId String?   @unique
  settings          Json      @default("{}")  // leaderboardEnabled, difficulty
  lastSyncedAt      DateTime?
}

model ClassTeacher {
  classId   String
  teacherId String
  type      ClassTeacherType
  @@id([classId, teacherId])
}

model Enrollment {
  classId   String
  studentId String
  status    EnrollmentStatus @default(ACTIVE)
  @@id([classId, studentId])
}

model ParentLink {
  parentId  String
  studentId String
  status    ParentLinkStatus
  method    ParentLinkMethod
  createdAt DateTime @default(now())
  @@id([parentId, studentId])
}

model FamilyCode {
  id        String    @id @default(cuid())
  studentId String
  code      String    @unique   // 6 digits
  expiresAt DateTime
  usedAt    DateTime?
}

// ---- Learning content (subject-agnostic) ----
model Subject {
  id    String @id @default(cuid())
  key   String @unique          // "math", "physics", "history"
  name  Json                    // { en, ar, fr }
  color String                  // design token name
  icon  String
}

model Topic {                    // a node in the skill graph
  id            String  @id @default(cuid())
  subjectId     String
  key           String  @unique // "geo.area"
  name          Json
  description   Json
  gradeLevel    Int
  curriculumRef String?         // official curriculum code
  posX          Int             // skill graph layout
  posY          Int
}

model TopicPrerequisite {
  topicId        String
  prerequisiteId String
  @@id([topicId, prerequisiteId])
}

model Mission {
  id                    String          @id @default(cuid())
  topicId               String
  classId               String?         // null = school library template
  createdById           String
  status                MissionStatus   @default(DRAFT)
  audience              MissionAudience @default(STUDENT)
  difficulty            Difficulty      @default(MEDIUM)
  title                 Json
  story                 Json            // the real-life hook
  steps                 Json            // ordered steps
  miniLesson            Json            // { text, visualSpec }
  proofSpec             Json            // what to submit: photos, explanation, number fields
  rubric                Json            // criteria for AI + peers
  safetyNotes           Json
  safetyCheck           Json?           // last AI safety result
  xpReward              Int
  estimatedMin          Int
  dueAt                 DateTime?
  classroomCourseWorkId String?         // set when posted to Classroom
  aiGenerated           Boolean         @default(false)
  createdAt             DateTime        @default(now())
}

model Submission {
  id              String           @id @default(cuid())
  missionId       String
  studentId       String
  attempt         Int              @default(1)
  status          SubmissionStatus @default(IN_PROGRESS)
  photoUploadIds  String[]
  audioUploadId   String?
  explanation     String?          // typed or speech-to-text transcript
  answers         Json?            // numbers the student reported
  aiCheck         Json?            // { score, correct, perCriterion, feedback, followUpQuestion, flags }
  followUpAnswer  String?
  aiFollowUpCheck Json?
  finalScore      Int?
  hintsUsed       Int              @default(0)
  gradeSynced     Boolean          @default(false)
  startedAt       DateTime         @default(now())
  submittedAt     DateTime?
  validatedAt     DateTime?
}

model PeerEvaluation {
  id            String    @id @default(cuid())
  submissionId  String
  evaluatorId   String
  sheet         Json                 // AI-generated evaluation sheet
  checklist     Json?                // evaluator's answers per criterion
  score         Int?
  comment       String?
  helpfulRating Int?                 // 1–5, given by the evaluated student
  fairnessFlag  Boolean   @default(false)
  status        String    @default("ASSIGNED") // ASSIGNED | DONE | EXPIRED
  assignedAt    DateTime  @default(now())
  doneAt        DateTime?
}

model TeacherReview {
  id           String   @id @default(cuid())
  submissionId String
  teacherId    String
  score        Int
  comment      String?
  overrode     Boolean  @default(false)
  createdAt    DateTime @default(now())
}

model Upload {
  id         String   @id @default(cuid())
  ownerId    String
  schoolId   String
  kind       String   // IMAGE | AUDIO
  path       String
  mime       String
  bytes      Int
  phash      String?  // perceptual hash for images (anti-copy)
  createdAt  DateTime @default(now())
}

// ---- Progress & gamification ----
model TopicProgress {               // per student × topic (NOT per class)
  studentId  String
  topicId    String
  state      MasteryState @default(LOCKED)
  bestScore  Int          @default(0)
  attempts   Int          @default(0)
  masteredAt DateTime?
  @@id([studentId, topicId])
}

model XpEvent {
  id        String   @id @default(cuid())
  studentId String
  subjectId String?
  amount    Int
  reason    String   // MISSION_VALIDATED | FIRST_TRY | FOLLOW_UP | PEER_EVAL_GIVEN | HELPFUL_REVIEW | STREAK | FAMILY_MISSION
  refId     String?
  createdAt DateTime @default(now())
}

model Wallet {                       // 42-style evaluation points
  studentId String @id
  points    Int    @default(3)
}

model WalletTx {
  id        String   @id @default(cuid())
  studentId String
  delta     Int
  reason    String   // SPENT_FOR_REVIEW | EARNED_BY_REVIEWING | TEACHER_GRANT | REFUND
  refId     String?
  createdAt DateTime @default(now())
}

model Badge {
  id       String @id @default(cuid())
  key      String @unique
  name     Json
  icon     String
  criteria Json
}

model StudentBadge {
  studentId String
  badgeId   String
  earnedAt  DateTime @default(now())
  @@id([studentId, badgeId])
}

model Streak {
  studentId  String    @id
  current    Int       @default(0)
  longest    Int       @default(0)
  lastActive DateTime?
}

// ---- Family & communication ----
model FamilyMissionConfirmation {
  id           String   @id @default(cuid())
  submissionId String   @unique
  parentId     String
  note         String?
  confirmedAt  DateTime @default(now())
}

model ParentSummary {
  id        String   @id @default(cuid())
  parentId  String
  studentId String
  weekStart DateTime
  locale    String
  content   Json     // { highlights, struggles, howToHelp, suggestedFamilyMission }
  createdAt DateTime @default(now())
  @@unique([parentId, studentId, weekStart, locale])
}

model Message {
  id        String    @id @default(cuid())
  fromId    String
  toId      String
  studentId String?
  body      String
  readAt    DateTime?
  createdAt DateTime  @default(now())
}

model Notification {
  id        String    @id @default(cuid())
  userId    String
  type      String    // LEVEL_UP | BADGE | PEER_REVIEW_ASSIGNED | STUCK_ALERT | MISSION_PUBLISHED | SUMMARY_READY | MEMBER_PENDING
  payload   Json
  readAt    DateTime?
  createdAt DateTime  @default(now())
}

// ---- AI ----
model AiCache {
  key       String   @id   // sha256 of (task + model + normalized input)
  response  Json
  createdAt DateTime @default(now())
}

model AiLog {
  id        String   @id @default(cuid())
  task      String
  model     String
  tokensIn  Int?
  tokensOut Int?
  ms        Int
  ok        Boolean
  error     String?
  createdAt DateTime @default(now())
}
```
Add Prisma relations and indexes as needed; keep the uniqueness constraints exactly as written.

---

## 6. Mission & submission lifecycle

### Mission
`DRAFT` (AI-generated or teacher-written) → teacher edits → **AI safety check** → `APPROVED` (visible to the class; optionally posted to Classroom) → `ARCHIVED`.
**Nothing reaches students without teacher approval.**

### Submission state machine
Implement as a pure function `transition(state, event, context)` in `packages/shared`, fully unit-tested.
```
IN_PROGRESS
  └─ submit (photos + explanation) ─────────────► SUBMITTED
SUBMITTED
  └─ AI check done ─────────────────────────────► AI_CHECKED   (feedback + 1 follow-up question)
AI_CHECKED
  ├─ AI score < 50 ─────────────────────────────► RETRY
  └─ follow-up answered ────────────────────────► FOLLOW_UP_ANSWERED
FOLLOW_UP_ANSWERED
  ├─ audience = FAMILY ─────────────────────────► FAMILY_CONFIRM
  ├─ AI flags contain "possible_copy" ──────────► TEACHER_REVIEW
  ├─ eligible peer exists AND wallet ≥ 1 ───────► PEER_REVIEW  (spend 1 point)
  └─ otherwise ─────────────────────────────────► TEACHER_REVIEW
FAMILY_CONFIRM
  └─ parent confirms ───────────────────────────► VALIDATED
PEER_REVIEW
  ├─ peer done, no fairness flag, score ≥ 70 ───► VALIDATED
  ├─ peer done, no fairness flag, score < 70 ───► RETRY
  ├─ fairness flag (|peer − AI| > 25) ──────────► TEACHER_REVIEW
  └─ no answer in 24h ──────────────────────────► reassign once, then TEACHER_REVIEW (refund the point)
TEACHER_REVIEW
  ├─ teacher score ≥ 70 ────────────────────────► VALIDATED
  └─ teacher score < 70 ────────────────────────► RETRY
RETRY
  └─ restart ───────────────────────────────────► IN_PROGRESS (attempt + 1)
```
- The teacher can override any score at any time (`TeacherReview.overrode = true`).
- `finalScore` = teacher score if present, else round(0.6 × AI + 0.4 × peer), else AI score (family path).
- On `VALIDATED`: award XP, set `TopicProgress` → `MASTERED`, unlock dependent topics (all prerequisites mastered → `AVAILABLE`), check badges, update streak, push the grade to Classroom if the mission is linked.

### Peer assignment algorithm
Eligible = same class, ACTIVE enrollment, topic MASTERED, not the submitter, fewer than 3 open reviews. Pick the one with the fewest open reviews; tie-break by least recently assigned. None → `TEACHER_REVIEW` (no point spent).

### Stuck detection (cron hourly + on events)
A student is "stuck" on a topic if any: ≥ 2 RETRY on the same topic, ≥ 3 hints used without submitting, or IN_PROGRESS > 48h. Create a `STUCK_ALERT` notification for the class teachers (deduplicate per student × topic per day).

---

## 7. Gamification rules

- **XP:** EASY 30 · MEDIUM 50 · HARD 80. Bonuses: validated on first try +10, follow-up understood +10, peer evaluation completed +15, helpful rating ≥ 4 received as evaluator +5, family mission +20, streak milestones (3/7/14 days) +15/+30/+60.
- **Levels:** `xpForLevel(n) = 50 × n × (n − 1)` → L2 = 100, L3 = 300, L4 = 600, L5 = 1000. Overall level + per-subject level.
- **Wallet (42-style):** start with 3 points. Spend 1 to enter peer review. Earn 1 per completed evaluation. Teachers can grant points.
- **Streak:** any validated submission or completed evaluation counts for the day (timezone `Asia/Beirut`).
- **Badges (seed):** `first_mission`, `shadow_hunter` (similar-triangles mission validated), `architect` (3 area/volume missions), `pizza_master` (circles), `peer_hero` (5 evaluations), `kind_reviewer` (3 helpful ratings ≥ 4), `streak_7`, `family_team` (2 family missions), `kitchen_chemist`, `time_traveler`.
- **Leaderboard:** class-level, OFF by default; the teacher toggles it in class settings. Show top 5 + "your rank" only, never a full ranking of weaker students.
- **No-shame UX:** never show "failed". RETRY copy = "Almost! Here's what to fix."

Put XP/level/streak math in `packages/shared` with unit tests.

---

## 8. Google Classroom integration (Classroom only for the build)

Wrap all Google calls behind an interface `ClassroomProvider` with two implementations:
- `GoogleClassroomProvider` — real API with the teacher's OAuth token, refresh handled.
- `FakeClassroomProvider` — fixtures in `apps/api/src/classroom/fixtures/*.json`, used in tests **and** as a demo fallback (`CLASSROOM_PROVIDER=fake`).

Features:
1. **List & import courses + rosters** (section 3.2).
2. **Publish mission → Classroom assignment:** `courses.courseWork.create` with title, description, due date, max points 100, and a **link material** to `WEB_URL/missions/:id`. Store `classroomCourseWorkId`.
3. **Grade passback:** on VALIDATED, with the teacher's token, patch the student's submission `draftGrade` and `assignedGrade` (= `finalScore`). This works only for coursework created by our Google Cloud project, which is why missions are posted through Tajriba. If the patch fails, keep the grade in Tajriba, set `gradeSynced=false`, show "Grade sync pending" to the teacher, retry on the next sync.
4. **Roster sync** (section 3.5).

The OAuth app runs in **Testing** mode with test users added in Google Cloud Console. Testing-mode refresh tokens expire after 7 days → handle `invalid_grant` with the "Reconnect Google Classroom" banner.

Microsoft Teams / LTI: **not built.** Mention them on the landing page roadmap only.

---

## 9. AI (OpenRouter)

### Client
- OpenAI-compatible `POST {OPENROUTER_BASE_URL}/chat/completions` with `Authorization: Bearer OPENROUTER_API_KEY` and headers `HTTP-Referer: WEB_URL`, `X-Title: Tajriba`.
- Models from env: `AI_MODEL_VISION` for anything with images, `AI_MODEL_FAST` for text-only tasks.
- **Every task returns JSON validated with zod.** Request JSON output via `response_format` when the model supports it; otherwise instruct "Return only JSON matching this schema". Invalid JSON → retry once with the validation error → then fail gracefully.
- `AiCache` keyed by sha256(task + model + normalized input) when `AI_CACHE=true`.
- `AiLog` for every call (no prompt content, no personal data in logs).
- 30s timeout. The UI never hangs: show a friendly "Bousla is thinking…" state with a retry button.
- `AI_PROVIDER=mock` → deterministic fixtures per task, used by all automated tests.
- Images: resize to max 1280px and compress server-side before sending.
- **Never send names or emails to the AI** — refer to "the student".

### Tasks (one service method + prompt file + zod schema each, in `apps/api/src/ai/tasks/`)
| Task | Model | Input | Output (JSON) |
|---|---|---|---|
| `generateMissions` | fast | topic, grade, locale, city, interests (optional), count | `[{ title, story, steps[], miniLesson{ text, visualSpec }, proofSpec, rubric[], safetyNotes, difficulty, estimatedMin }]` |
| `safetyCheckMission` | fast | mission JSON | `{ safe, issues[], saferVersion? }` — reject heights/climbing, fire, sharp tools without an adult, chemicals beyond kitchen-safe, going out alone or at night, contacting strangers, sharing location |
| `miniLesson` | fast | topic, locale | `{ text (≤ 120 words), visualSpec }` — visualSpec = simple shapes the UI renders as SVG |
| `hint` | fast | mission, student's partial work, hint level 1–3 | `{ hint }` — never the final answer |
| `checkSubmission` | vision | mission, rubric, photos, explanation, answers | `{ score 0–100, correct, perCriterion[], feedback (encouraging, ≤ 60 words), followUpQuestion, flags[] }` (flags e.g. `photo_unrelated`) |
| `checkFollowUp` | fast | question, answer, context | `{ understood, scoreDelta (−10..+10), feedback }` |
| `peerSheet` | fast | mission, rubric, submission summary | `{ checklist[{ criterion, whatToLookFor }], questionsToAsk[3], commonMistakes[] }` |
| `parentSummary` | fast | the week's validated missions, struggles, locale | `{ highlights[], struggles[], howToHelp, suggestedFamilyMission }` in plain Arabic/English/French |
| `groupSession` | fast | stuck students × topics (anonymized ids) | `{ groups[{ topic, studentIds, plan[3] }] }` |

### Anti-cheat
- The follow-up question is mandatory before validation.
- Perceptual hash (`sharp` + average hash) on every photo. Same or near-same photo from a different student in the same class → add `possible_copy` flag → TEACHER_REVIEW.

---

## 10. Voice & files

- **Speech-to-text:** browser Web Speech API (`webkitSpeechRecognition`) in Chrome, language from the user's locale (`ar-LB`, `en-US`, `fr-FR`). Show the live transcript; the student can edit it. Fallback: typed explanation. Also record the audio (MediaRecorder) and upload it as evidence.
- **Uploads:** `POST /uploads` (multipart): images (jpg/png/webp; convert heic → jpg) max 8 MB, audio (webm/ogg/m4a) max 5 MB. Store at `UPLOAD_DIR/{schoolId}/{yyyy-mm}/{uuid}.ext`. Serve via `GET /uploads/:id` with a permission check. **Strip EXIF on save** (removes GPS location).

---

## 11. API surface (NestJS modules)

`auth` · `schools` · `memberships` · `invites` · `classes` · `classroom` · `subjects` · `topics` · `missions` · `submissions` · `peer-reviews` · `teacher-reviews` · `progress` · `gamification` · `families` · `parents` · `messages` · `notifications` · `dashboards` · `uploads` · `ai` · `seed`

Key endpoints (REST, JSON, cookie auth):
```
GET  /auth/google                    GET  /auth/google/callback
GET  /auth/dev?as=<handle>           (only if DEV_LOGIN=true)
POST /auth/logout                    GET  /me   (user + memberships + active role)
POST /me/active-role

POST /schools                        GET  /schools/:id
POST /schools/join {code}            GET  /schools/:id/members?status=PENDING
POST /memberships/:id/approve        POST /memberships/:id/reject
POST /invites                        GET  /invites/:token     POST /invites/:token/accept

GET  /classroom/connect              GET  /classroom/courses
POST /classroom/import {courseIds[]} POST /classes/:id/sync
GET  /classes/:id                    GET  /classes/:id/students
PATCH /classes/:id/settings

GET  /subjects                       GET  /subjects/:key/graph?studentId=   (nodes + edges + mastery states)
POST /missions/generate {topicId, classId, count}    (AI → DRAFT)
GET  /missions?classId&status        GET  /missions/:id     PATCH /missions/:id
POST /missions/:id/approve {postToClassroom, dueAt}  (runs safety check first)

POST /submissions {missionId}        (start)
GET  /submissions/:id
POST /submissions/:id/hint
POST /submissions/:id/submit         (photoUploadIds, audioUploadId, explanation, answers)
POST /submissions/:id/follow-up {answer}
POST /submissions/:id/retry

GET  /peer-reviews/assigned          GET  /peer-reviews/:id
POST /peer-reviews/:id/complete {checklist, score, comment}
POST /peer-reviews/:id/rate {helpfulRating}

GET  /teacher/review-queue           POST /submissions/:id/teacher-review {score, comment}
GET  /dashboards/teacher/:classId    (heatmap, stuck alerts, recent activity)
POST /dashboards/teacher/:classId/group-sessions   (AI suggestions)
GET  /dashboards/director/:schoolId  (KPIs, coverage, classes, engagement, parent participation)
GET  /dashboards/parent/:studentId

POST /families/code                  (student creates a code)
POST /families/link {code}           (parent)
POST /families/missions/:submissionId/confirm {note}
GET  /parents/summary/:studentId?week=
POST /parents/summary/:studentId/generate

GET  /progress/me                    GET  /gamification/me   (xp, level, wallet, streak, badges)
GET  /classes/:id/leaderboard        (403 if disabled)
GET  /notifications                  POST /notifications/:id/read
GET  /messages?with=                 POST /messages
POST /uploads                        GET  /uploads/:id
```
All request/response bodies have zod schemas in `packages/shared`, used by both apps (typed API client in web).

---

## 12. UI / UX — "kids love it, teachers trust it"

Load the `frontend-design` skill (if available) before building UI.

### Two visual modes, one design system
- **Student mode:** playful, bright, game-like, big touch targets, motion, mascot.
- **Adult mode (teacher, parent, director):** calm, clean, data-dense, same palette but quieter; built with shadcn/ui.

### Design tokens (Tailwind theme + CSS variables, light & dark)
- Primary **Tajriba Violet** `#6C4CF1` · Secondary **Mint** `#2DD4A7` · Accent **Sunny** `#FFC83D` · **Coral** `#FF7A59` · **Sky** `#4CB8FF`.
- Subject colors: Math violet, Physics sky, Chemistry mint, Biology green `#5CC45C`, History coral, Languages sunny.
- Backgrounds: off-white `#FAF8FF` (light), deep ink `#14112B` (dark).
- Radius: cards 20px, buttons 16px, primary CTAs pill. Chunky student buttons with a 4px bottom "press" shadow that sinks on tap.
- Fonts (Google Fonts): student headings **Baloo Bhaijaan 2** (Latin + Arabic, rounded); body **Nunito** (Latin) + **Tajawal** (Arabic). Adult mode uses Nunito/Tajawal only.
- Touch targets ≥ 48px, body ≥ 16px, WCAG AA contrast, respect `prefers-reduced-motion`.
- Full RTL: logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`), mirror directional icons.

### Mascot: **Bousla** (بوصلة — "compass")
An original, friendly compass character: round body, big eyes, a needle that points toward the student's next mission. Build it as an SVG React component from simple geometric shapes with 5 moods: `happy`, `thinking`, `cheering`, `curious`, `sleepy`. Use it on onboarding, empty states, loading ("Bousla is thinking…"), hints, follow-up questions and level-ups. Also generate the PWA icons from it.

### Motion & feedback (student mode)
- XP gain: "+50 XP" floats up; the XP bar fills with a spring.
- Level up: full-screen modal, confetti, Bousla cheering, new level number.
- Badge earned: card flips in with a shine sweep.
- Mission validated: "Validated ✓" stamp animation.
- Node unlocked on the skill map: grey → color pop with a glow pulse travelling along the edge.
- Sounds optional, OFF by default (toggle in settings).

### Screens

**Shared**
- Public landing: hero "School of 2036 — learn by living", 3 feature cards (real-life missions, level up, learn from peers), "Sign in with Google", language switch, roadmap strip (Google Classroom ✓ · Microsoft Teams · Moodle/Canvas via LTI).
- Sign-in, role switcher (avatar menu), notifications drawer, settings (language, theme, sounds).
- Dev login page (only when `DEV_LOGIN=true`): one-click cards for each seeded user — used for filming.

**Student (mobile-first; bottom tabs: Home · Map · Missions · Reviews · Me)**
1. **Home:** greeting + Bousla, level ring with XP bar, streak flame, wallet coins, big "Continue mission" card, "Peer reviews waiting" card, latest badges, PWA install card.
2. **Skill map (per subject, subject switcher chips):** zoomable graph (`@xyflow/react`), round node tiles with icons; LOCKED (grey + lock), AVAILABLE (color + pulse), IN_PROGRESS (progress ring), MASTERED (gold border + star). Tap a node → bottom sheet with its missions.
3. **Mission stepper:**
   - Step 1 "The story" — illustrated real-life hook.
   - Step 2 "60-second lesson" — text + rendered visualSpec (e.g. building, shadow, triangle).
   - Step 3 "Your mission" — step checklist, safety chip, time estimate.
   - Step 4 "Show your proof" — camera capture / upload (multiple photos), number fields from `proofSpec`, mic button with live transcript, editable text.
   - "I'm stuck" → hint 1 → hint 2 → hint 3 → "Ask a friend".
4. **Result:** score dial, per-criterion chips, Bousla asks the follow-up (voice or text answer), then the status: "Sent to Karim for peer review" / "Validated" / "Almost! Here's what to fix".
5. **Peer review:** submission photos + explanation, AI checklist (tap ✓/✗ per criterion), 3 questions to ask, score slider, comment → "+15 XP · +1 point".
6. **Me:** avatar, overall + subject levels, badge grid, streak calendar, wallet history, "Invite my family" (big 6-digit code + share button).

**Teacher (desktop-first, tablet-friendly; sidebar: Classes · Missions · Review · Insights)**
1. **Onboarding:** join school → connect Classroom → import classes (checkbox list) → success.
2. **Class overview:** **heatmap** (students × topics, color by mastery), stuck alerts with "Plan a group session" (AI), activity feed, "Sync now", leaderboard toggle.
3. **Mission studio:** subject → topic → "Generate 3 missions" → editable cards → safety badge (pass / issues + safer version) → "Approve & publish" (toggle "Post to Google Classroom", due date).
4. **Review queue:** TEACHER_REVIEW and flagged submissions; side-by-side photo / explanation / AI check / peer score; approve, adjust score, comment; "Grade sync pending" indicators.
5. **Student page:** read-only skill map, history, parent links, "Invite parent by email", message parent.

**Parent (mobile-first)**
1. **Link child:** big friendly 6-digit keypad.
2. **Child dashboard:** child switcher, simplified skill map, "This week" AI summary in the chosen language, photos of recent work, strengths & struggles in plain words, "How you can help (10 min)".
3. **Family missions:** list + "We did it together!" confirmation with an optional note.
4. **Messages:** chat with the teacher.

**Director / Admin (desktop)**
1. **School overview:** KPIs (active students this week, missions validated, avg mastery, parent participation %), trend line.
2. **Curriculum coverage:** grade × subject × topic matrix with % mastered per class.
3. **Classes table:** teacher, students, engagement, stuck count.
4. **Members:** pending approvals (approve/reject), invite teacher, school code with copy button.
5. **Settings:** leaderboard policy, mission safety rules, default language.

### PWA
- `@serwist/next`, `app/manifest.ts` (name "Tajriba", theme `#6C4CF1`, maskable icons from the Bousla SVG).
- Cache the app shell and static assets; network-first for API calls; friendly offline page.
- "Install Tajriba" card on student home (Android) + "Add to Home Screen" hint for iOS.

---

## 13. Seed data (demo world) — `pnpm db:seed`

- **School:** "Tripoli Future School", city Tripoli, code `TRP-2036`.
- **Users (dev handles for `/auth/dev?as=`):**
  - `director` — Mr. Sami Haddad (DIRECTOR)
  - `rana` — Ms. Rana Khoury, math teacher (TEACHER)
  - `lea` — Lea, 13 (STUDENT)
  - `karim` — Karim, 13 (STUDENT)
  - `omar` — Omar, 13 (STUDENT)
  - `mona` — Mona, Lea's mother (PARENT, linked to Lea)
  - `pending_teacher` — a teacher with a PENDING membership (for the director demo)
- **Class:** "8B Math" (`classroomCourseId` from the fake provider fixtures), teacher Rana, students Lea/Karim/Omar.
- **Geometry skill graph (Grade 8):**
  1. `geo.area` Perimeter & area → "Tile your bedroom"
  2. `geo.angles` Angles (prereq 1) → "Is your staircase ramp-safe?"
  3. `geo.similar` Similar triangles (prereq 2) → **"Measure your building with shadows"** ← hero demo mission
  4. `geo.circles` Circles & sectors (prereq 1) → "Fair pizza for 7"
  5. `geo.volume` Volume (prereq 1) → "How much water fits in your roof tank?"
- **Bonus subjects (prove it generalizes):** Physics `phy.speed` "Your walking speed to school"; History `his.oral` "Interview a grandparent".
- **Family mission:** "Tile the balcony together" (topic `geo.area`, audience FAMILY).
- **Progress state:** Karim mastered 1–3 (eligible evaluator for Lea). Lea mastered 1–2, node 3 AVAILABLE, streak 3, level 2, wallet 3. Omar mastered 1, 2 retries on node 2 (triggers a stuck alert).
- **AI fixtures** for the mock provider covering every task, written to match the seeded missions, so the whole demo runs with `AI_PROVIDER=mock` too.
- **Fixture photo** `e2e/fixtures/shadow.jpg` (generate a simple placeholder image) for tests.
- The seed is idempotent (`upsert`). `pnpm db:reset` = drop, migrate, seed — run before filming.

---

## 14. Testing (required — do not skip)

### Unit (Jest — `packages/shared` + API services)
- Submission state machine: every transition, including fairness flag, peer timeout + refund, family path, copy flag.
- XP / level / streak / badge math (midnight edge in Asia/Beirut).
- Permission helpers: every role × resource row of section 4, allowed and denied.
- Peer assignment (eligibility, load balancing, fallback to teacher).
- Family codes: create, expire, reuse, wrong school.
- Roster sync: add, archive, re-add, co-teacher import, email fallback match.
- AI JSON validation: valid, invalid-then-fixed, invalid twice (graceful failure).
- Safety filter: an unsafe mission is rejected.

### Integration (Jest + Supertest, real Postgres in Docker, `AI_PROVIDER=mock`, `CLASSROOM_PROVIDER=fake`)
- Onboarding: director creates school → teacher joins by code → approved → imports class → student logs in and sees the class.
- Golden loop: start mission → submit → AI check → follow-up → peer assigned → peer completes → VALIDATED → XP + unlock + badge + grade passback called on the fake provider.
- Authorization: every role hitting forbidden endpoints gets 403 (student reading another student's submission, parent reading an unlinked child, teacher reading another teacher's class).

### E2E (Playwright, `e2e/`, web + api running with mocks)
1. `student-golden-path.spec.ts` — Lea: map → hero mission → upload fixture photo → explanation → follow-up → "Sent to Karim".
2. `peer-review.spec.ts` — Karim completes the review → Lea sees Validated, XP animation, a new node unlocked.
3. `teacher.spec.ts` — Rana: heatmap shows Omar stuck → generate missions → approve & publish.
4. `parent.spec.ts` — Mona: sees the weekly summary + confirms the family mission.
5. `director.spec.ts` — approves the pending teacher; the coverage matrix renders.
6. `rtl.spec.ts` — Arabic locale renders RTL without layout breaks on student home and the mission screen.
7. Student and parent specs also run at a mobile viewport (Pixel 7).

`pnpm test` = unit + integration · `pnpm e2e` = Playwright · `pnpm verify` = lint + typecheck + test + e2e.

---

## 15. Engineering rules

- TypeScript strict everywhere. No `any` without a comment explaining why.
- Validate every external input with zod (API bodies, AI output, Classroom responses).
- Default-deny authorization; every controller method has a policy.
- No secrets in code or logs. Encrypt Google refresh tokens at rest (AES-GCM, key from env).
- Never send student names or emails to the AI. Strip EXIF from photos. No location tracking.
- Idempotent jobs (sync, stuck detection, summaries).
- Friendly UI errors, never raw stack traces. Every async action has loading, empty and error states.
- All UI strings through `next-intl` (en + ar from day one).
- Small components; student and adult UIs share tokens, not layouts.
- Record non-obvious choices in `DECISIONS.md`.
- Commit after each phase with a clear message.

---

## 16. Build plan (phases — each ends with passing tests)

**Phase 0 — Scaffold (≈45 min)**
pnpm monorepo, Next.js + NestJS + shared package, Docker Postgres, Prisma 7 setup, Tailwind + shadcn, fonts, design tokens, next-intl (en/ar), Serwist PWA manifest, Jest + Playwright configured.
✅ `pnpm dev` runs both apps; a smoke test passes.

**Phase 1 — Auth, schools, roles (≈1.5h)**
Google OAuth + dev login, `/me`, memberships, role switcher, school create/join/approve, invites, PolicyGuard.
✅ Permission unit tests + onboarding integration test.

**Phase 2 — Classroom (≈1h)**
`ClassroomProvider` (fake first, then Google), import courses + rosters, co-teacher rule, sync cron + "Sync now".
✅ Roster sync tests.

**Phase 3 — Content & skill graph (≈1h)**
Subjects / topics / prerequisites, seed (section 13), skill map UI with states, topic bottom sheet.
✅ Graph API returns the correct states for Lea, Karim and Omar.

**Phase 4 — Mission flow + AI (≈2.5h)** ← core of the demo
AI client + mock provider + cache + logs, mini-lesson, mission stepper, uploads (EXIF strip, phash), speech-to-text, hints, checkSubmission, follow-up, state machine.
✅ Golden-loop integration test up to FOLLOW_UP_ANSWERED + student E2E.

**Phase 5 — Peer review + gamification (≈2h)**
Wallet, peer assignment, AI peer sheet, review screen, fairness flag, XP / levels / streaks / badges, unlocks, all reward animations.
✅ Full golden loop to VALIDATED + peer E2E.

**Phase 6 — Teacher (≈1.5h)**
Class heatmap, stuck alerts, AI group sessions, mission studio (generate → safety → approve → post to Classroom), review queue, grade passback.
✅ Teacher E2E.

**Phase 7 — Parent (≈1h)**
Family code linking, child dashboard, weekly AI summary (cached), family missions + confirmation, messages.
✅ Parent E2E.

**Phase 8 — Director (≈45 min)**
School KPIs, coverage matrix, classes table, member approvals, settings.
✅ Director E2E.

**Phase 9 — Polish for the video (≈1.5h)**
Bousla moods everywhere, empty states, loading skeletons, RTL pass, dark-mode pass, mobile pass, landing page, install prompt, `pnpm db:reset` demo script; run the hero flows once with the real OpenRouter key so responses are cached.
✅ `pnpm verify` green.

If time runs short, cut in this order: messages → director settings → AI group sessions → leaderboard → dark mode.
**Never cut:** the golden loop, peer review, teacher heatmap + mission studio, parent summary + family mission, Classroom import.

---

## 17. Video demo script (the app must support every beat)

1. **0:00–0:30** — Problem: "When will I ever use this?"
2. **0:30–1:00** — Vision: the School of 2036 = learn by living, levelling up, teaching each other.
3. **1:00–1:20** — Ms. Rana imports "8B Math" from Google Classroom in one tap; students just sign in.
4. **1:20–2:45** — Lea: skill map → "Measure your building with shadows" → 60-second lesson → real outdoor footage measuring shadows → photo + voice explanation → Bousla's follow-up → sent to Karim.
5. **2:45–3:15** — Karim reviews with the AI checklist → Lea validated → XP, level-up, badge, a new node unlocks; the grade appears in Google Classroom.
6. **3:15–3:45** — Ms. Rana: heatmap shows Omar stuck → AI group-session plan → generates and publishes a new mission, plus a history mission to show any subject works.
7. **3:45–4:10** — Mona (parent): Arabic weekly summary, photos of Lea's work, family mission "Tile the balcony together" confirmed.
8. **4:10–4:30** — Director: approves a new teacher; school coverage rising across classes.
9. **4:30–5:00** — How it works + scale: any subject, Google Classroom today → Microsoft Teams and Moodle/Canvas via LTI next, ready for the 16 partner schools.

---

## 18. Start now

1. Read this whole file.
2. Execute Phase 0. Show the folder tree and the passing smoke test.
3. Continue phase by phase. After each phase: run the tests, fix failures, summarize what works, then move on.
4. When something here is ambiguous, choose the simplest option that keeps the golden demo path working, and record it in `DECISIONS.md`.
