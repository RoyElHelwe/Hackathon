# Decisions

Non-obvious choices made while building Tajriba. CLAUDE.md is the spec; this file records how ambiguities were resolved.

## Stack & tooling
- **Versions pinned to known-stable majors**: Next.js 15.5, React 19.1, NestJS 11, Prisma 7.10, TypeScript 5.9, Tailwind 4, zod 4, Playwright 1.56 (matches the pre-installed Chromium). Newer majors existed but were not needed.
- **Prisma 7**: `prisma-client` generator with `moduleFormat = "cjs"` and `importFileExtension = ""` so the generated client works with Nest's CommonJS build and ts-jest. `prisma.config.ts` loads the root `.env` (Prisma 7 no longer auto-loads it) and the client uses the `@prisma/adapter-pg` driver adapter.
- **Same-origin API**: the web app proxies `/api/*` to the Nest API (Next rewrites). The httpOnly session cookie therefore works without CORS, and the Google Classroom link material points to `WEB_URL/missions/:id`.
- **i18n without locale in the URL**: next-intl reads the `NEXT_LOCALE` cookie (falls back to `Accept-Language`). Switching language also saves `User.locale`, which drives the language of AI output (summaries, feedback, hints). English is the fallback for any missing Arabic key.
- **shadcn/ui**: components are written in the shadcn style (Radix primitives + cva + tailwind-merge) inside `apps/web/src/components/ui` instead of running the shadcn CLI.
- **Google sign-in** uses `google-auth-library`'s `OAuth2Client` directly (one code path for login and the incremental Classroom consent) instead of `passport-google-oauth20`.

## Auth & permissions
- JWT payload is `{ sub, mid }` where `mid` is the active membership. `POST /me/active-role` re-issues the cookie. With no `mid`, the highest role wins (director > admin > teacher > parent > student).
- `PolicyGuard` is global and **default-deny**: a route must be `@Public()` or declare `@Can(action, resource)`. The guard checks the coarse role table (`roleMayEver`); services then call `can()` with object facts. Both live in `packages/shared/src/permissions.ts` and are unit-tested for every role × resource row.
- `@Can(..., 'self')` means "any signed-in user, even without a school" (onboarding: create/join school, link a child).
- Teachers may approve **student** join requests (the "I have a school code" path); only directors/admins approve staff.
- Invites must be accepted with the Google account the invite was sent to.

## Learning flow
- **State machine** (`packages/shared/src/state-machine.ts`) is pure. Low AI scores use an explicit `AI_LOW` event (AI_CHECKED → RETRY) fired by the service right after the AI check; the follow-up question is mandatory before any validation path.
- **Effective AI score** = AI score + follow-up `scoreDelta`, clamped 0–100. `finalScore` uses it.
- **Retry keeps the same Submission row** (attempt + 1, proof fields cleared). "≥ 2 RETRY on a topic" is computed from `attempt` history.
- **Teacher override** is allowed in any submitted state. Overriding a peer review refunds the student's point; overriding a validated submission updates the score and re-syncs the grade but never re-awards XP (validation is idempotent per submission via the `MISSION_VALIDATED` XP event).
- **Peer review is blind**: the evaluator never sees the AI score (fairness compares the two).
- **Family missions**: the student starts and submits the proof (photo + explanation + follow-up); a linked parent confirms. Parents never submit on behalf of the child.
- **Progress is per student × topic.** Missing `TopicProgress` rows are derived from prerequisites (AVAILABLE if all prerequisites are mastered, else LOCKED), so new topics just work.
- **Rewards are stored in the `SUBMISSION_VALIDATED` notification payload** so the student sees the XP/badge/level-up animation the next time they open the app (e.g. after Karim reviews while Lea is offline). Marking it read prevents replays.
- Added a 6th geometry topic, **`geo.pythagoras`** ("Is your TV really 55 inches?"), after similar triangles so that validating the hero mission visibly unlocks a node on camera.
- Lea's seeded XP is 255 so the hero mission (≥ 50 XP) triggers the level-up to 3 in the video.

## AI
- All tasks live in `apps/api/src/ai/tasks/` with a prompt, a zod schema and a deterministic **mock**. `AI_PROVIDER=mock` is the default for local runs and tests.
- A deterministic **safety prefilter** (keywords for heights, fire, sharp tools, chemicals, going out alone/at night, strangers, location) runs in addition to the AI safety check; a mission is safe only if both agree.
- If a model rejects `response_format`, the call is retried once without it. Invalid JSON → one retry with the validation error → `503` with a friendly "Bousla is thinking too hard" message; the student's work is saved and "Check again" re-runs the check.
- Group-session planning anonymizes students as `s1, s2, …` and maps back server-side. No names or emails are ever sent to the model.

## Classroom
- **Fake provider** fixtures (`apps/api/src/classroom/fixtures/courses.json`): 8B Math (Lea, Karim, Omar), 8A Math (24 students) and 9A Science. Courses whose `teacherGoogleIds` contains `*` are offered to any teacher so the import demo works for a real Google login in fake mode.
- 8B Math is pre-imported by the seed (the golden path needs it). For the "import in one tap" video beat, import **8A Math** ("Imported 24 students into 8A Math"); re-importing 8B is idempotent.
- The hero mission is seeded as already posted to Classroom (`fake-cw-shadows`) so grade passback happens in the demo.
- Connecting Classroom in fake mode (or when Google isn't configured) is instant.

## Data & seed
- `pnpm db:seed` is idempotent: static data is upserted; seeded users' activity is wiped and recreated; missions without a seed `key` in 8B Math (rehearsal drafts) are deleted.
- A second teacher (Hassan) with 7A/9B Math and 22 deterministic students gives the director dashboard a realistic school.
- Uploads are re-encoded with sharp (drops EXIF/GPS) and get an average hash; a near-identical photo (Hamming ≤ 5) from a classmate adds `possible_copy` → teacher review.

## UI
- Student mode uses chunky "press" buttons, Baloo Bhaijaan 2 headings and motion; adult mode reuses the tokens with calmer layouts. Dark mode is a class on `<html>` saved in localStorage.
- (Superseded by the Arzino redesign below.) PWA icons are generated with `node scripts/make-icons.cjs`.
- Sounds are synthesized with Web Audio (no assets) and are off by default.

## Tajriba Campus (2D peer study rooms + AI voice-interview exams)
- **Inspired by dev_pulse** (2D office, Phaser + Socket.IO + WebRTC), rebuilt for Tajriba. Its bugs were deliberately not copied: presence is tracked **per socket** (a second tab or a stale disconnect never evicts a user), a 15 s grace period hides reconnects, and sockets are authenticated from the same `tj_session` cookie as HTTP.
- **Sockets never end sessions.** A study session ends only on "End session" or when nobody has been in it for 3 min (cron sweep); an exam attempt ends on the server-owned timer (`endsAt`), "I'm done", the last question, or the window closing. A disconnect is logged (`LEAVE`/`REJOIN`) and the room resumes from the DB.
- **Socket.IO through the Next.js `/api` rewrite** (WebSocket upgrade and polling both work), path `/api/socket.io` with `addTrailingSlash: false` because Next redirects trailing slashes. No extra port, so it fits the single Heroku dyno.
- Global HTTP guards skip non-HTTP contexts; the gateway authenticates in Socket.IO middleware and every room join goes through `RoomAccessService` (default deny).
- **Voice = native WebRTC mesh** (≤ 3 peers: 2 students, or a student + watching teachers), signaling over Socket.IO, STUN + optional TURN from env (`TURN_URLS`…, served by `GET /realtime/ice`). simple-peer was not used (needs Node polyfills in the browser). Glare-free: between two speakers the smaller user id calls; a student always calls a spectator; spectators never send audio.
- **Proximity audio** in the study room: `<audio>` volume follows avatar distance (`voiceGain`).
- **Recording**: each participant records only their own mic (MediaRecorder, Opus 24 kbps, 10 s chunks) and uploads ordered chunks (`RecordingChunk`, idempotent per seq); concatenated chunks of one recorder are a playable webm. ~180 KB/min, stored in Postgres like uploads. The AI side of exams is stored as text turns. A "Recording" chip and a notice before joining are always shown.
- **Action log**: `SessionEvent` (join/leave/rejoin/emote/reaction/turns/spectator/end) is the replay timeline.
- **AI voice**: browser speech-to-text (Chrome) + `speechSynthesis` for Bousla, OpenRouter text model for `prepareExam`, `interviewTurn`, `examReport`, `discussionCards`. Typed answers always work as a fallback. Student answers and lesson content are wrapped in tags and treated as untrusted (prompt-injection guard).
- **Question bank sized to the time**: ~1 question per 90 s (3–12). At most 1 follow-up per question; under 25 s left the interviewer wraps up. If the model says FINISH while questions and time remain, the interview goes on.
- **Emotions**: `interviewTurn` returns the student's detected `mood` + an empathetic `emoji`; Bousla's face reacts (nervous → reassuring, confident → cheering).
- **Hidden scores**: per-answer assessments, AI score and report are only shaped out to staff (`canSeeExamScore`) until the teacher approves/releases; parents then see the result. If the AI is down at grading time, the deterministic report (from per-answer scores) is used so the teacher is never blocked.
- **Spectating is transparent**: the student sees "Your teacher is watching".
- Exams are built from **course lessons** (Classroom posts) of the class's course; the seed creates the 8B lessons exactly as lesson sync would (same fingerprint + source ids) so a later sync keeps them.
- Map art is drawn with Phaser primitives (the dev_pulse "Modern Office" tileset forbids redistribution).

## Final redesign: Arzino (2026-10-09)
- **Mascot renamed Bousla → Arzino (أرزينو)**, a little Lebanese cedar with a book stack and pencil. Chose "Arzino" over "ArziQ": it reads friendly for 12–15 year olds and is easy to say in Arabic. The AI persona in every prompt and every UI string was renamed; the campus furniture kind `bousla` → `arzino`.
- **Art comes from the Arzi design pack** (`Arzi-Designs/`, git-ignored). What we use was copied into the repo: stickers trimmed and converted to webp (`apps/web/public/arzino/*.webp`, ≤ 560 px, ~2 MB total), PWA icons regenerated from the `cheer` pose, docs + overview sheets in `docs/arzino-design/`. The `Arzino` component picks a sticker per mood (aliases `happy`/`cheering`/`curious` keep old call sites working) and adds a light idle animation per pose family.
- **Palette moved to Lebanon's colors on white** (cedar, flag red, Mediterranean blue, flame for streaks only). Legacy token names (`violet`, `mint`, `sunny`, `coral`, `sky`) stay as CSS aliases of the new colors so every screen re-themed at once; new code uses `cedar`/`flag`/`med`/`flame`/`lock`.
- **Type**: Nunito 600–900 everywhere, Noto Kufi Arabic for Arabic (replaces Baloo Bhaijaan 2 + Tajawal) to match the design's rounded, heavy Duolingo-like look.
- "42 School" wording removed from the product; peer review is described in our own words.
- The redesign brief every screen follows is `docs/arzino-design/REDESIGN-BRIEF.md`.

## 3D Arzino in the campus (2026-10-09)
- **Source**: `arzi_rigged.fbx` (git-ignored, 21 MB: 9-bone rig, one textured mesh, clips Idle/Walk/Run/Sit/Wave/Celebrate). Converted in headless Chromium with three.js (FBXLoader → GLTFExporter) and optimized with gltf-transform (webp textures 1024 px, quantized geometry): `apps/web/public/arzino/arzino-3d.glb`, **526 KB**.
- **Disappointed** was not in the file: it is baked on the same rig from the Idle pose (body slumps forward, books tip, arms hang, a small head shake and a sigh), 3.4 s.
- **Rendering**: the 2D Phaser campus stays the source of truth (movement, collisions, zones, labels, bubbles, Exam Hall overlays). A transparent three.js canvas (`components/campus/arzino-3d.ts`) is laid over it; each frame the scene passes every character's feet position on screen, facing (from the real direction of travel) and state. Orthographic camera in screen pixels, models tilted 0.42 rad so the map reads as seen from above. If WebGL or the model fails, the flat avatars stay.
- **States**: moving → Walk, Shift (or a remote speed > 275 px/s) → Run, standing still for 1.2 s on a sofa/bench/exam seat or after the 🪑 emote → Sit (clip plays once and holds), 👋 → Wave, 😂💃🤯👏 and the ❤️🔥⭐🎉🙌👍💡 reactions → Celebrate, 😞 → Disappointed. Exam Hall: a live interview sits, a finished one celebrates, a missed one is disappointed.
- **Coaches**: every Arzino in a room is a 3D model: idles, turns toward you (never fully away), waves when you come near (once per 12 s), and celebrates / looks disappointed with you.
- New emotes `sit` 🪑 and `sad` 😞 (shared enum, keys 7–8). Own emotes and reactions are now echoed locally by the room hook (the server only relays to the others), so you see your own bubble and animation.
