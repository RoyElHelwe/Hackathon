# Testing Tajriba VR on a Meta Quest 2 (no cable needed)

WebXR only needs an **HTTPS link opened in the Meta Quest Browser**.

## 1. Get an HTTPS link
- **Deployed app**: `https://<your-app>.herokuapp.com` (Heroku serves HTTPS).
- **Live from your laptop**: run `pnpm dev`, then `cloudflared tunnel --url http://localhost:3000` and use the `https://….trycloudflare.com` link it prints. Stop the tunnel when you're done (with `DEV_LOGIN=true` anyone with the link can sign in as a demo user).

## 2. On the headset
1. Open **Meta Quest Browser** and type the link (or share it from the Meta Horizon phone app).
2. Open **`/vr/check`** first: every row should be green. Press **Test** next to Microphone and allow it. The "Voice answers" line tells you which exam mode this headset uses. Take a screenshot (Meta button → Camera).
3. Sign in (Google, or the demo login page), then open **`/vr`**. Before going to the campus, a study room or an exam, press **Allow the microphone first** on the flat page, then **Enter VR**.
4. Add **`?debug=1`** to any `/vr` link to see FPS and errors on a panel low on your left (the "remote debugger" without a cable). FPS should stay at 72.
5. Try hand tracking too: put the controllers down and pinch to press buttons.

## 3. What to try
| Experience | How to get there | Check |
|---|---|---|
| Shadow Lab | VR hub → Shadow Lab, or the hero mission's 60-second lesson → "Try it in VR" | Sun lever moves both shadows; point at the red rings and pull the trigger; the triangles line up; pick the height |
| Campus | VR hub → Campus, or Campus page → "Walk it in VR" | Left stick walks, right stick turns; a laptop classmate sees you move; doors and Bousla open panels |
| Study room | Study Hall door → Invite, or a study room → "Join in VR" | Voice with the laptop partner, together timer, shared discussion card, End session |
| Exam room | VR hub → Exam room, Exam Wing door, or the exam page → "Take it in VR" | Tap "Tap to answer", talk, tap again; check the text; Send; the teacher can watch live from a laptop |

## 4. Laptop and automated tests (no headset)
- `http://localhost:3000/vr?emulate=1` runs an emulated Quest 2 in Chrome (or open `/vr` without it to explore in 3D with the mouse and WASD).
- `pnpm e2e -- vr` runs the VR end-to-end tests against the emulator.

## 5. Filming
Cast the headset (meta.com/casting) and screen-record, or use the Quest's own **Record video** (Meta button → Camera).
