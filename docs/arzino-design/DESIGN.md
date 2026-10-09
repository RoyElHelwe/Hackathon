# Arzi design

The look, layout and flows of the Arzi app (ClassFlow AI prototype), with the mascot reactions mapped to every moment.

- **Live prototype:** https://claude.ai/artifact/HLEQmmDmnA43pXf9qY8jYg (private until you share it from the page's Share menu)
- **Offline copy:** open `prototype/arzi-app.html` in Chrome or Safari. Keep the `a/` folder next to it (it holds the Arzi stickers). Fonts load from Google Fonts, so the first open needs internet.
- **Screens:** 46 screens in `screenshots/desktop/` (1440 × 900) and `screenshots/mobile/` (390 × 844), numbered in flow order. `screenshots/overview-*.png` show them all at a glance.

Everything in the prototype uses synthetic sample data. Simulated parts carry a **Demo mode** badge, unbuilt ideas carry **Planned** or **Roadmap**.

---

## 1. Principles

1. **White ground.** Pure white `#FFFFFF`, no cream. Light cedar-grey only for quiet surfaces.
2. **Lebanon's colors.** Cedar green, flag red, white, plus a Mediterranean blue. Orange is reserved for the streak flame.
3. **Show, don't tell.** Arzi, drawings and big numbers carry the message. A screen has one short title and at most one line under it.
4. **Duolingo's game structure.** A winding path of lessons, one question per screen, a feedback bar that slides up, XP, streak, lesson-complete tiles, a mascot that reacts.
5. **Rewards come from learning, not screen time.** Wardrobe items and badges unlock from mastery and finished units. Leaderboards are off by default.
6. **Honest labels.** Demo mode, Planned and Roadmap pills are part of the design system, not afterthoughts.

## 2. Color tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | Page background |
| `--soft` | `#F3F7F5` | Hover, quiet surfaces |
| `--line` | `#E2E9E5` | Borders, dividers |
| `--ink` | `#16262A` | Main text |
| `--ink2` | `#4B5C60` | Secondary text (passes 4.5:1 on white) |
| `--cedar` / `-d` / `-ink` / `-soft` | `#00A651` / `#00843F` / `#006B37` / `#E2F5EA` | Primary actions, correct, Biology, "got it" |
| `--red` / `-d` / `-ink` / `-soft` | `#E4252D` / `#B3171E` / `#B3171E` / `#FDE6E7` | Mistakes, weak concept, School role, Arabic |
| `--blue` / `-d` / `-ink` / `-soft` | `#1C8BE0` / `#136CB2` / `#0D5A99` / `#E3F1FC` | Selection, XP, Teacher role, Maths, "getting there" |
| `--flame` / `-d` / `-soft` | `#FF9600` / `#D97A00` / `#FFF1DE` | Streak only, "Planned" pill |
| `--lock` / `-d` | `#E6EBE8` / `#C9D2CD` | Locked nodes, disabled buttons |

**Rules**
- Every colored button has a darker bottom edge (`-d`), 5 px, that collapses when pressed.
- Mastery uses three colors only: red below 50 %, blue 50–69 %, cedar 70 % and up.
- Roles have a color: Student cedar, Teacher blue, School red. Classes take their Classroom color.

## 3. Type

- **Nunito** 700 / 800 / 900 for everything (rounded, friendly, readable for 12–16 year olds).
- **Noto Kufi Arabic** for Arabic words (e.g. العربية, مرحبا).
- Scale: 64 logo · 30–34 page titles · 23–26 question and card titles · 17–18 body in lessons · 15 secondary · 12 uppercase labels with 0.09em tracking.
- Buttons: uppercase, 16 px, 0.08em tracking.

## 4. Components

| Component | Notes |
|---|---|
| **Chunky button** | 52 px tall, 16 px radius, 5 px darker bottom edge. Variants: cedar (default), red, blue, flame, ghost (white with grey edge), disabled (grey). |
| **Path node** | 74 × 68 circle with an 8 px darker edge. States: done (check), current (star, progress ring, bouncing START bubble), locked (grey, lock). Kinds: lesson ★, flashcards, practice (dumbbell), chest, unit test (trophy). Nodes zig-zag by ±52 / ±78 px. |
| **Unit banner** | Class-colored block with "Subject · Unit · Teacher", unit title, and a Notes button. |
| **Stat bar** | Class chip, streak 🔥, XP ⚡, cedar level. Top bar on tablet and phone, right rail on desktop. |
| **Choice tile** | 2 px border + 5 px bottom. Selected = blue, correct = cedar, wrong = red, others dimmed after checking. Picture tiles hold the cell drawings. |
| **Feedback bar** | Slides up after Check. Correct: cedar tint, Arzi pose, praise, +XP. Wrong: red tint, Arzi oops, correct answer, **quote from the teacher's lesson with its timestamp**. |
| **Score tiles** | Three colored tiles on lesson complete: XP (blue), accuracy (cedar), time (red). |
| **Rail card** | 20 px radius cards on the right: weakest concept, daily goal, due in Classroom. |
| **Pills** | `Demo mode` (ink), `Planned` (flame-soft), `Roadmap` (dashed grey). |
| **Cell drawings** | Simple SVG cells for prophase, metaphase, anaphase, telophase. Used in questions, notes, lesson intro and flashcards. |
| **Understanding map** | Concepts as circles around the unit; size and color = mastery. |

## 5. Layout and breakpoints

| Width | Layout |
|---|---|
| ≥ 1180 px | Left nav (248 px) · content · right rail (360 px), max 1360 px wide |
| 721–1179 px | Icon-only nav (96 px) · content; stats move to a sticky top bar; rail hidden |
| ≤ 720 px | Bottom tab bar (5 tabs) · sticky top stat bar · single column; onboarding drops its colored side panel |

Lessons and end screens are full-screen and centered at 680 px max. Onboarding on desktop is split: a role-colored panel with Arzi on the left, the step on the right.

## 6. Arzi reaction map

Arzi always reacts. Pick the pose by moment, not at random.

| Moment | Pose |
|---|---|
| Welcome, sign-in | `welcome` |
| Student role card, correct answer, path friend | `cheer`, `correct`, `starry-eyed`, `cool` (rotate) |
| Teacher role, notes, reteach | `teaching` |
| School role, review, checklists | `clipboard` |
| AI is working, hints, permissions | `thinking` |
| Reading notes, lesson intro, flashcards | `reading` |
| Uploading a lesson, writing questions | `writing` |
| Wrong answer | `oops` (after 3 misses: `exhausted`) |
| Weakest concept, practice call | `practice-nudge`, `laser-focus` |
| Class missed a concept (teacher) | `flop-cry` |
| Lesson complete | `celebrate` (perfect: `party`) |
| Streak up / streak screen | `streak-hug`, `streak-buddy` |
| Streak in danger / lost / on hold | `streak-danger` / `streak-lost` / `frozen` |
| 3 in a row | `on-fire` |
| Offline | `sleepy` |
| Missed you / waiting | `bored-waiting` |
| New pack arrived | `shocked` |
| Cold start of the week | `cold` |
| Daily goal, parent digest | `warm` |
| Classes, school identity | `lebanese-pride` |
| Achievements | `trophy` |
| Private settings | `embarrassed` |

Mood colors (red when mad, blue-grey when sad) live in `mascot/mood-colors/`.

## 7. Screens and flows

The numbers match the screenshot files (46 screens, desktop and phone).

### Who creates what (the setup logic)
1. **The school** signs up first, drops the roster, and Arzi creates every class in Google Classroom and invites teachers and students.
2. **Teachers** get an invite email. They sign in and accept the classes the school made for them. No invite yet: invite the school admin, or start with their own Classroom class.
3. **Students** are added by the school, or join with a class code from a teacher.

Every onboarding shows this as a 3-step picture: School → Classes → Teachers + students.

### Logged out
01 Landing page: hero, how it works (3 steps), "Just tell Arzi", the 2036 understanding map, call to action. Log in / Get started.
02 Log in: pick a Google account (sample accounts for each role).
03 Role picker: Student · Teacher · School, plus parent.

### School (does setup first)
04–06 Onboarding, 3 steps: admin sign-in → drop roster → "Ready to create" summary → **Create classes and invite everyone**
07 Classroom created, with progress (Demo mode)
38 Overview · 39 Ask Arzi (create classes, cover an absence, build a timetable, send an announcement) · 40 Timetable and absences (confirm cover) · 41 Roster check · 42 Cedar Cup (class vs class) · 43 Parent digest (Planned) · 44 Roadmap

### Teacher
08 "Did your school invite you?" → 09 Yes: your classes are ready, accept → 10 No: invite your admin or use your own class
30 Home · 31 **Ask Arzi**: hold the mic or tap an idea ("Make a quiz from today's lesson", "I'm sick tomorrow", "Send this week's agenda"). Arzi answers with an action card, the teacher confirms.
32 My week: timetable from the school, away day marked, weekly agenda · 33 Away from school sheet: when, why (school only), substitutes asked, catch-up pack, notice
34–35 New lesson pack · 36 Review · 37 Class insight · 38 Class league

### Student
11–13 Onboarding, 3 steps: sign in → "Your classes are here" (from school, or enter a class code) → daily goal
14 Learn path · 15 **Teacher away**: banner on top of the path ("Ms. Haddad is away, Mr. Nassar covers, start the catch-up") + the weekly agenda the teacher posted
16 Lesson intro · 17–19 Lesson and feedback · 20 Lesson complete · 21 Streak up
22 Practice · 23 **Cedar league** (weekly class league) · 24 Understanding map · 25 Classes · 26 Streak · 27 Profile · 28 Flashcards · 29 Arzi moment

### Parent
46 Lea's week (Planned).

### Leaderboards (learning points, privacy first)
- Points come from learning only: concept mastered +30, weak concept improved +15, lesson finished +10, streak day +5. Never from time in the app.
- **Student:** weekly class league with podium, promotion line (top 3 move up), "24 pts to 1st" with the concept to practise. Students who opt out show as "A classmate".
- **Teacher:** same league for each class, can be turned off per class, class vs class comparison, most improved student.
- **School:** Cedar Cup, sections ranked on average mastery gained. No individual students at school level.

### Ask Arzi (chat and voice)
- Available to teachers and schools. Type, tap a suggestion, or hold the green mic button.
- Arzi always replies with a **draft action card** (quiz, cover plan, agenda, classes, timetable, announcement). Nothing happens until the person taps confirm.
- Voice and actions are simulated in the prototype and labelled "Concept".

### Arzi moments (button bottom right)
Offline, flame flickering, streak reset, missed you, streak on hold, take a breather, new pack, quiz on Thursday, cold start. The panel also switches roles, shows "Student: teacher away", the role picker and the home page.

## 8. Assets in this folder

| Folder | What |
|---|---|
| `prototype/` | The clickable app and its 37 web stickers |
| `screenshots/` | 46 desktop + 46 mobile screens, plus overview sheets |
| `mascot/turnaround.png` | Character model sheet (front, 3/4, side, back, faces, crown) |
| `mascot/reaction-sheets/` | Original generated sheets A–F |
| `mascot/stickers-png/` | 37 transparent PNGs, 1024 px, same scale and baseline |
| `mascot/stickers-512/` | Same at 512 px |
| `mascot/extras/` | 8 near-duplicates set aside |
| `mascot/mood-colors/` | Red (mad) and blue-grey (sad) versions |

Generation: MiniMax Design, GPT Image 2.5 Sunburst, background set to Transparent. Cut with `arzi/tools/cut_sheet.py`.

## 9. Not done yet

- Sitting side-eye pose: generated, not exported.
- Animation format (sprite sheet vs frame sequence vs Rive/Lottie): to decide.
- Arabic right-to-left layout: not designed.
- The prototype is a design build. It is not wired to the Node server, and it is not a PWA yet.
- Cedar Hill School, Lea Khalil, Ms. Haddad and all numbers are invented sample data.
