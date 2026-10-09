# Feature list: Student, Teacher, School, Parent

Project: ClassFlow AI prototype, app name **Arzi** (working name), mascot **Arzi** (cedar).
Hackathon: Experia Education Hackathon, topic "The School of 2036". Final submission deadline Saturday 10 Oct 2026, 4:00 PM (full early bonus if submitted before 3:00 PM).

**Status legend**
- **Built**: works in the Node prototype today (API-tested; the browser UI still needs a full test pass).
- **Clickable**: designed and clickable in the new UI prototype (`prototype/arzi-app.html`), with sample data. Not wired to the server yet.
- **Designed**: screen drawn, not clickable.
- **Planned**: agreed idea, not designed or built yet.
- **Roadmap**: vision only, never claim it as working.

When a row says "Built + Clickable", the logic exists in the Node prototype and the new screen for it exists in the UI prototype. The two still need connecting.

**Core loop (the heart of the product)**
Lesson -> AI learning pack (notes, concepts, questions, flashcards) -> student practice -> mistakes tagged to **concepts** -> targeted revision -> teacher sees which concept the class missed.

**2036 framing (for the pitch)**
The exam as a once-a-term event should not exist in 2036. Every lesson assesses itself, the school always knows what each student understands, and teachers coach instead of doing admin. This maps to the brief's "new forms of assessment", "AI-powered learning" and "school information systems".

---

## 0. Start (all roles)

| Feature | Status |
|---|---|
| Landing page for logged-out visitors: hero, how it works, "Just tell Arzi", 2036 map, call to action | Clickable |
| Log in with Google (account picker) | Clickable (sample accounts) |
| Role picker: Student, Teacher, School, plus "I'm a parent" | Clickable |
| Setup order made explicit: school creates the classes, teachers and students get invited | Clickable (3-step picture in every onboarding) |
| "Switch role" in the nav and in the Arzi moments panel (for the demo) | Clickable |

## 1. Student

### Sign-in and setup
| Feature | Status |
|---|---|
| Sign in with the school Google account | Clickable (prototype server still uses a student picker) |
| "Your classes are here": classes the school added, or join with a class code | Clickable |
| Permission note: read-only, never posts as the student | Clickable (one line on sign-in) |
| Daily goal (5 / 10 / 15 / 20 min) shown as 4 Arzi poses, reminder time toggle | Clickable |
| Install as a PWA (home-screen icon, full screen, no app store) | Designed earlier; dropped from onboarding to keep it 3 steps; the app is NOT yet a PWA |

### Home and navigation
| Feature | Status |
|---|---|
| Learning path: lesson, flashcard, practice, chest and unit-test nodes, Arzi beside the path | Clickable |
| Stat bar: class, streak, XP, cedar level (top bar on phone, right rail on desktop) | Clickable |
| Right rail: weakest concept, daily goal, due in Classroom | Clickable |
| Classes tab that mirrors Google Classroom (colored course cards, next lesson, unit progress) | Clickable |
| "Open in Classroom" link on classes and due items | Clickable |
| Class page with tabs: Path, Stream, Classwork, Concepts | Designed (old canvas), not in the new prototype |
| Lesson pack intro: one-line summary, phase drawings, question count, time, XP, "Checked by teacher" badge | Clickable |
| Unit notes as pictures ("Mitosis in 4 pictures") | Clickable |
| Responsive layout: desktop, tablet, phone | Clickable |

### Learning loop
| Feature | Status |
|---|---|
| AI notes and key concepts from the teacher's lesson | Built |
| Questions tagged to a concept | Built (multiple choice) |
| Question types: picture choice, multiple choice, match pairs, fill the blank, put in order | Clickable (server only generates multiple choice today) |
| Evidence quote shown after each answer (the line from the lesson the question came from) | Built + Clickable |
| Correct-answer feedback bar with Arzi, praise, +XP, "3 in a row" | Clickable |
| Wrong-answer feedback: correct answer, lesson quote, timestamp | Clickable (quote and evidence built; replay link planned) |
| Lesson-complete screen: XP, accuracy, time, weakest concept, "Practise it" | Built (weakest concept) + Clickable (screen) |
| Targeted revision on the weakest concept (3 questions, that concept first) | Built (practice weak concept) + Clickable |
| Concept score: new = 0.5 x old + 0.5 x (correct ? 1 : 0), starts at 0.5, weak below 0.5 | Built |

### Flashcards and revision
| Feature | Status |
|---|---|
| Flashcards with Again / Hard / Good / Easy = review in 1 / 2 / 4 / 7 days | Built + Clickable (flip card) |
| Weak-concept cards come first | Planned (shown as "weak ones first" in the UI) |
| Practice screen: concept tiles with mastery bar and an Arzi face per level | Clickable |
| 15-minute catch-up when a lecture was missed (ideas, clips, check, due) | Clickable (summary sheet) |
| Offline mode: notes and flashcards cached, answers sync when back online | Designed (Arzi moment); not built |
| "Ask my lecture": answer a question using only the lecture as its source | Roadmap |

### Motivation (rewards must come from learning, not time in the app)
| Feature | Status |
|---|---|
| XP and daily streak | Clickable |
| Streak calendar, weekends as rest days | Clickable |
| Streak-up screen after a lesson | Clickable |
| Badges (First cedar, Comeback, Unit master) | Clickable |
| Arzi wardrobe unlocked by mastery (flag cape, tarboush, shades, Cedars snow, cedar cup, star eyes) | Clickable |
| Gentle nudges: max one a day, never after 9 pm, tied to a real lesson or weak concept, no guilt | Clickable as "Arzi moments"; sending not built |
| Arzi reactions: 37 poses + 6 mood-color versions | Done (see `mascot/`) |
| **Cedar league**: weekly class leaderboard with podium and promotion line, points from learning only (concept mastered +30, improved +15, lesson +10, streak day +5) | Clickable |
| "Show my name" toggle; private students appear as "A classmate" | Clickable (toggle only) |
| **Teacher away banner** on the student home: who covers, catch-up pack | Clickable |
| **Weekly agenda** posted by the teacher, shown on the student home | Clickable |

### 2036 additions (for the pitch)
| Feature | Status |
|---|---|
| **Understanding map**: a living concept map per subject that replaces the report card | Clickable (sample data; uses the existing concept scores) |
| Continuous assessment: no separate exam, every lesson updates the map | Planned (follows from the existing concept scores) |
| Trilingual content (Arabic, French, English) | Planned; school onboarding already asks for teaching languages |

---

## 2. Teacher

| Feature | Status |
|---|---|
| Teacher onboarding: "Did your school invite you?" → accept the classes the school made, or invite the admin / use own Classroom class | Clickable |
| **Ask Arzi** chat with voice: make a quiz, report an absence, send the agenda. Replies with an action card to confirm | Clickable concept (voice and actions simulated) |
| **My week**: timetable from the school, away day marked | Clickable |
| **I'll be away**: pick day and reason, Arzi drafts substitutes (school confirms), catch-up pack and a notice to students | Clickable (simulated) |
| **Weekly agenda** to all classes (Classroom + student home) | Clickable (simulated) |
| Class league per class (can be turned off), class vs class, most improved | Clickable |
| Home: upload entry, packs waiting for review, class cards with each class's weakest concept | Clickable |
| Upload a lecture: transcript text, audio or video (up to about 15 MB) | Built; Clickable screen (sample lesson) |
| AI pack building with visible steps (reading, concepts, questions, checking quotes, ready) | Built (sample pack always works; live Gemini untested) + Clickable progress screen |
| **Grounding check**: every question must carry an evidence quote found in the transcript, otherwise it is dropped. Retry once, then error | Built |
| Review screen: each question with its evidence quote and timestamp, approve / edit, "1 question dropped" notice | Clickable (approve works; edit is a placeholder) |
| Post to Classroom: due date, topic, what students get (quiz, notes, flashcards); only when all are approved | Built as simulation (DEMO MODE) + Clickable |
| Class insight: KPIs, mastery per concept chart, weakest concept, most common wrong answer | Built (over a synthetic 24-student cohort plus the live student) + Clickable |
| Suggested 5-minute reteach (compare plant and animal cytokinesis, replay the clip, extra cards) | Clickable; suggestion only, nothing sent automatically |
| "May need a hand" list (private to the teacher) | Clickable |
| Right rail: class missed, students practised this week, time saved (estimate) | Clickable |
| Drive / Meet recording import | Roadmap |
| Slides assistant | Roadmap |
| Teacher as coach: less admin, more time on the concepts that need it | Pitch message |

---

## 3. School (admin / coordinator)

| Feature | Status |
|---|---|
| School onboarding in 3 steps: admin sign-in → drop roster → summary → create classes and invite everyone | Clickable |
| Languages detected from the roster (Arabic, French, English) | Clickable (sample) |
| Prerequisites (Workspace for Education, allow Arzi in Admin console, teachers accept) | Designed; moved out of onboarding into the setup notes |
| **Ask Arzi** for admins: create classes, cover an absence, build next week's timetable, send an announcement to all students | Clickable concept (simulated) |
| **Timetable and absences**: absence list with suggested free, qualified cover, confirm; class timetable with cover marked | Clickable prototype (solver is Roadmap) |
| **Cedar Cup**: section vs section on average mastery gained, no individual ranking | Clickable |
| Import roster CSV (messy files, bad emails, missing teachers flagged) | Built + Clickable (sample roster) |
| Detect grades, sections, subjects, classes, students, teachers | Built + Clickable |
| Review screen before creating anything (counts, rows to fix, classes ready) | Clickable |
| Create Classroom courses from the roster (3 grades, 12 classes, 143 students in the sample) with progress | Built as simulation (DEMO MODE) + Clickable |
| Topics created per course | Built as simulation |
| Invite students and teachers | Built as simulation; real behavior depends on admin rights |
| Report after setup | Built + Clickable |
| Overview dashboard: counts, weekly practice by grade, setup checklist, needs attention | Clickable (synthetic numbers) |
| `.xlsx` upload | Planned |
| Timetable builder (rules in plain words, solved by a constraint solver such as OR-Tools, not an LLM) | Roadmap; UI clickable with sample data |
| Substitute finder | Roadmap; UI clickable with sample data |
| Absence follow-up (catch-up pack to students who missed class) | Roadmap (tile shown) |
| Meet attendance (needs eligible Workspace editions) | Roadmap (tile shown) |

## 4. Parent

| Feature | Status |
|---|---|
| Weekly digest: "What my child understands this week", working on, minutes practised, streak | Planned; preview is Clickable |
| No grades of other children, no ranking | Design rule |
| Send a cheer sticker that Arzi delivers after the next lesson | Planned; preview is Clickable |

---

## 5. Platform and honesty rules

- Stack: zero-dependency Node 18+ server, JSON file store (`data.json`), Gemini API for the pack, single-page UI. Run with `npm start`, `POST /api/reset` restores the seed.
- New UI prototype: one HTML file + sticker images, no build step. It is a design build with sample data, not yet connected to the server.
- Student-facing app is a **PWA**. It is a separate installable app next to Classroom, not an add-on inside it.
- Synthetic data only. No real student records. Names (Lea Khalil, Ms. Haddad, Cedar Hill School) are invented.
- Anything simulated is labelled in the UI (Demo mode, synthetic cohort, Planned, Roadmap).
- AI output is grounded and teacher-reviewed before students see it.
- API keys stay on the server.
- Never claim a feature that is not implemented.

## 6. Suggested build order for the last day

1. Run the Node prototype in a browser and fix what breaks.
2. Port the new UI (`prototype/arzi-app.html`) onto the real API: the lesson engine and the teacher review/insight screens first, since those are the demo.
3. Wire Arzi's poses into the quiz feedback (the mapping is in `DESIGN.md`, section 6).
4. Make it a PWA (manifest, service worker, icons).
5. Record the 5-minute video with the demo script: landing page → school roster → Classroom setup → teacher uploads lesson → review → student lesson with Arzi → weakest concept → revision → teacher insight updates → understanding map as the 2036 close.
