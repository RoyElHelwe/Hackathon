# Tajriba × Arzino — final redesign brief

The product stays **Tajriba (تجربة)**. The AI coach/mascot is now **Arzino (أرزينو)** — a little Lebanese cedar
with a book stack and a pencil on its head. "Bousla" and the compass are gone everywhere.
Source design: `docs/arzino-design/DESIGN.md` (read §1–§6) and `docs/arzino-design/screens/overview-*.png`.

## Look
- White ground (`bg-background` = #FFF). Quiet surfaces `bg-muted` (#F3F7F5). Lines `border-border` (#E2E9E5).
- Colors (Tailwind classes exist for all): `cedar` (+`-d`, `-ink`, `-soft`) primary/correct/student,
  `flag` (+`-d`, `-soft`) mistakes/School role, `med` (Mediterranean blue, +`-d`, `-ink`, `-soft`) selection/XP/Teacher role,
  `flame` (+`-d`, `-soft`) streak only, `lock` / `lock-d` locked + disabled.
  Legacy names still work as aliases (`violet`→cedar, `coral`→flag, `sky`→med, `sunny`→gold, `mint`→fresh leaf) but
  prefer the new names in anything you touch. Never hard-code the old purple hexes (#6C4CF1 etc.).
- Mastery uses three colors only: red (`flag`) < 50 %, blue (`med`) 50–69 %, `cedar` ≥ 70 %.
- Roles: Student cedar · Teacher blue (med) · Director/School red (flag) · Parent flame/warm.
- Type: Nunito everywhere (Noto Kufi Arabic in Arabic, automatic). `font-display` = weight 900.
  Page titles 30–34px `font-black`; card titles 20–24px; labels `.eyebrow` (12px, uppercase, 0.09em tracking).
- Duolingo-style chunky UI: cards `rounded-[20px] border-2 border-border shadow-[0_4px_0_0_var(--border)]`
  (the `Card` component and the `.chunky` / `.chunky-hover` utilities already do this).
  Buttons: `<Button variant="kid">` (cedar), `kidMint` (blue), `kidCoral` (red), `kidSunny` (flame), `kidGhost` (white) —
  uppercase, tracked, 5px darker bottom edge that sinks on press. Adult `default`/`outline` are also chunky now.
- Progress bars: `bg-lock` track, colored fill with the `.bar-gloss` highlight.
- Show, don't tell: one short title + at most one line under it. Big numbers, Arzino and drawings carry the message.
- Keep dark mode working (tokens already flip under `.dark`); keep RTL (logical classes `ms-/me-/ps-/pe-/start/end`).
- Respect `prefers-reduced-motion`. Use `motion` for springy entrances; don't overdo it on adult screens.

## Arzino
`import { Arzino, ArzinoSays, type ArzinoMood } from '@/components/arzino'`
`<Arzino mood="celebrate" size={160} pop />` — `size` is a square box; stickers are real artwork in `/public/arzino/*.webp`.
Poses (pick by moment, never random — see DESIGN.md §6):
welcome, cheer, correct, starry-eyed, cool, teaching, clipboard, thinking, reading, writing, oops, exhausted,
practice-nudge, laser-focus, flop-cry, celebrate, party, streak-hug, streak-buddy, streak-danger, streak-lost, frozen,
on-fire, sleepy, bored-waiting, shocked, cold, warm, lebanese-pride, trophy, embarrassed, determined, sad, mad, melted,
fainted, sick, proud, fireworks, missed-you, surprise, try-again, please-practice, heartbroken, streak-small.
Aliases: happy→welcome, cheering→celebrate, curious→starry-eyed.
Every screen should have Arzino somewhere meaningful (headers, empty states, loading = `thinking`, errors = `oops`,
success = `celebrate`/`party`, teacher = `teaching`/`clipboard`, director = `clipboard`/`lebanese-pride`, parent = `warm`).
Use generous sizes on hero moments (160–320px) — the artwork is good, show it off.

## Rules
- All UI strings through next-intl, **English and Arabic** both updated (`apps/web/messages/{en,ar}/<namespace>.json`).
  Rename any remaining user-facing "Bousla" → "Arzino" / "أرزينو". Remove any "42 School"/"42 Beirut" mention.
- Don't change API calls, data flow, routes, or `data-testid` attributes (e2e tests depend on them). This is a visual pass.
- Keep components small; TypeScript strict; no `any`.
- Only edit the files you own (listed in your task). If you need a shared primitive changed, leave a note in your report.
- Verify with `cd apps/web && npx tsc --noEmit` and `npx eslint <your files>`; the dev server runs at http://localhost:3000
  (log in with `http://localhost:3000/api/auth/dev?as=<handle>`, handles: director, rana, lea, karim, omar, mona).
