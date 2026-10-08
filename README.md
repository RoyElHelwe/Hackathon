# Tajriba (تجربة) — learn by living

> **Experia Education Hackathon · "The School of 2036"**
> Students learn any school subject through **real-life missions**, level up like a **game**, and **evaluate each other like 42 School**. Teachers guide, parents take part, schools see real learning. **Bousla**, the AI compass, coaches everyone.

The full product spec is in [`CLAUDE.md`](CLAUDE.md); design decisions are in [`DECISIONS.md`](DECISIONS.md).

## What's inside

| Path | What |
|---|---|
| `apps/web` | Next.js 15 PWA for every role (student, teacher, parent, director), English + Arabic (RTL), light/dark |
| `apps/api` | NestJS 11 API · Prisma 7 + PostgreSQL · Google OAuth + Classroom · OpenRouter AI |
| `packages/shared` | zod schemas, permission rules, submission state machine, XP/level/streak/badge math |
| `e2e` | Playwright end-to-end tests (desktop + Pixel 7) |

## Quick start (local)

Requirements: Node 22, pnpm 10, PostgreSQL 16 (or Docker).

```bash
cp .env.example .env              # works as-is: mock AI, fake Classroom, demo logins
docker compose up -d db           # or use a local Postgres with the URL from .env
pnpm install
pnpm db:migrate                   # create tables
pnpm db:seed                      # the demo world (idempotent)
pnpm dev                          # web http://localhost:3000 · api http://localhost:4000
```

Open http://localhost:3000/login and pick a demo account (one-click sign-in, `DEV_LOGIN=true` only).

**One command with Docker:** `cp .env.example .env && docker compose up --build`.

### Demo accounts

| Handle | Who | Role |
|---|---|---|
| `lea` | Lea, 13 — has the hero mission ready | Student |
| `karim` | Karim, 13 — mastered similar triangles (Lea's evaluator) | Student |
| `omar` | Omar, 13 — stuck on angles | Student |
| `rana` | Ms. Rana Khoury, 8B Math | Teacher |
| `hassan` | Mr. Hassan Merhi, 7A & 9B Math | Teacher |
| `mona` | Mona, Lea's mother (Arabic) | Parent |
| `director` | Mr. Sami Haddad | Director |
| `pending_teacher` | Nadine, waiting for approval | Teacher (pending) |

School code: **TRP-2036** (Tripoli Future School).

### Before filming

```bash
pnpm db:reset    # drop, migrate, seed
```

Then follow the video script in `CLAUDE.md` §17. Golden path: Lea → Map → *Similar triangles* → "Measure your building with shadows" → photo + voice explanation → Bousla's follow-up → sent to Karim → Karim reviews → Lea validated, level 3, *Shadow hunter* badge, *Pythagoras* unlocks, grade sent to Classroom.

## Real Google & AI

| Variable | Use |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in + Classroom (OAuth app in Testing mode with test users) |
| `CLASSROOM_PROVIDER=google` | Use the real Classroom API (`fake` = fixtures) |
| `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_VISION` | Real AI via OpenRouter. Set a spending limit on the key. |
| `AI_CACHE=true` | Cache identical AI requests (stabilizes the demo) |

Classroom scopes requested incrementally by teachers: `classroom.courses.readonly`, `classroom.rosters.readonly`, `classroom.profile.emails`, `classroom.coursework.students`. Missions published from Tajriba become Classroom assignments (with a link back), and validated scores are written back as grades.

## Tests

```bash
pnpm test        # shared unit tests + API integration tests (real Postgres DB "tajriba_test", mock AI, fake Classroom)
pnpm e2e         # Playwright (starts api + web if not running; reseeds the demo world)
pnpm verify      # lint + typecheck + test + e2e
```

The API tests need a `tajriba_test` database (same user as `.env`); migrations are applied automatically.

## Privacy & safety

- Never sends student names or emails to the AI; photos are re-encoded (EXIF/GPS stripped) and only served to people allowed to see them.
- Default-deny permissions on every endpoint, mirrored in the UI.
- Every AI-generated mission passes a safety prefilter **and** an AI safety check, and nothing reaches students without teacher approval.
- Google refresh tokens are encrypted at rest (AES-256-GCM).
