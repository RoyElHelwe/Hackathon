# Exam Hall — spatial spectating for AI interview exams

## Goal
A teacher supervises every Bousla interview of an exam from one 2D floor: one glass room per student, corridors between
them. Walking into a room = hearing it (the student's mic + Bousla's lines). Switching students takes one key press.

## Why (problems in the current flow)
1. "Listen to the student" never connects: the student calls the spectator on join, before the teacher's page listens
   for signals; after the click nobody re-calls (spectators never initiate).
2. The student page never emits `speaking`, so "Speaking now" never shows for the teacher.
3. The teacher never hears Bousla (TTS plays on the student's speakers and is removed by echo cancellation).
4. Switching students = navigate back, reload Phaser, renegotiate, click "Listen" again. One room at a time.

## Design
### Shared (`packages/shared/src/campus.ts`)
- `CampusMapId` adds `'hall'`; `ZoneKind` adds `'hall_room'`.
- `examHallMap(roomIndexes)`: deterministic grid (≤ 6 per row) of 260×190 rooms; each room has walls with a door gap
  on top facing a corridor, a desk + Bousla, a `hall_room` zone `room-<roomIndex>` and a `seat` point. Spawns in the
  top corridor. Exposes `hallRoomOf(map, roomIndex)`.
- Room names: `hall:<examId>` (parseRoom accepts it).
- `PlayerState.listening?: boolean` (spectators only). New message `spectate:listen { room, on }`.

### API
- `RoomGrant` carries the map object (`mapDef`) and its client room name; the hall map is built from the exam's
  attempts. Hall access: teachers of the exam's class, director/admin of the school. Nobody publishes audio there.
- `spectate:listen`: only a spectator of that exam room; sets `listening`, broadcasts `player:listening`, logs
  `SPECTATOR_LISTENING` (on/off) in the session timeline.

### Audio rule (fixes 1)
The student's browser calls a spectator only while that spectator is `listening`, and hangs up when it stops.
The spectator emits `listen on` only after its signal handler is live. Same rule fixes the old Watch page.

### Web
- `/teacher/exams/[id]/hall`: walks in `hall:<examId>`, spectates all NOT_STARTED / IN_PROGRESS attempt rooms
  (`useSpectateMany`). Each room shows a student puppet (name, speaking ring), mood emoji, Q n/N, timer, status.
- Entering a room zone focuses it. With "Turn on hall audio" (one click, autoplay policy), the focused room mounts a
  listener: WebRTC from the student + Bousla's AI turns spoken by the teacher's browser TTS (mute toggle).
- Switching: keys 1–9, `[` / `]`, or the room list → teleports the avatar into the room.
- Side panel: focused attempt's transcript with per-answer scores + live speech line.
- Exam page gets "Open the Exam Hall"; the old Watch page stays.
- Student: "Your teacher is supervising 👀" when a spectator is present; "🎧 Ms. Rana is listening now" while one
  is listening. The exam page now emits `speaking` (fixes 2).

## Out of scope (later)
Attention signals, teacher interventions (extra time, notes), smarter Bousla turn-taking, SFU for very large halls.

## Tests
Shared unit (hall layout, parseRoom); integration (hall access allow/deny, `spectate:listen` broadcast + rules);
E2E: Rana opens the hall, jumps to Lea's room, sees the transcript; Lea sees "listening".
