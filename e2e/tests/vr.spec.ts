import { expect, test, type Page } from '@playwright/test';
import { loginAs, reseed } from './helpers';

/**
 * Tajriba VR, tested with an emulated Meta Quest 2 (`?emulate=1` installs IWER over the browser's WebXR).
 * Scenes are driven through `window.__tajribaVR` (dev builds only) instead of aiming controller rays at pixels.
 */
declare global {
  interface Window {
    __tajribaVR?: { session: string; scene: string; step: number; enterVR(): Promise<void>; setScene(s: string): void; [k: string]: unknown };
  }
}

// fake microphone: voice in the study room and the exam room runs headless
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['microphone'] });

async function vr(page: Page) {
  await expect.poll(() => page.evaluate(() => !!window.__tajribaVR)).toBe(true);
}

async function enterVR(page: Page) {
  await page.getByTestId('enter-vr').click();
  await expect.poll(() => page.evaluate(() => window.__tajribaVR?.session)).toBe('immersive-vr');
}

test.describe('Tajriba VR (emulated Quest 2)', () => {
  test.beforeAll(() => reseed());

  test('device check: a headset is ready, and "Enter VR test" starts a session', async ({ page }) => {
    await page.goto('/vr/check?emulate=1');
    await expect(page.getByTestId('vr-ready')).toContainText('Ready for VR');
    for (const k of ['secure', 'webxr', 'vr', 'webgl2']) await expect(page.getByTestId(`check-${k}`)).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('vr-ua')).toContainText('Quest 2');
    await page.getByTestId('enter-vr-test').click();
    await expect.poll(() => page.evaluate(() => window.__tajribaVR?.session)).toBe('immersive-vr');
  });

  test('without a headset the check says so honestly', async ({ page }) => {
    await page.goto('/vr/check?emulate=0');
    await expect(page.getByTestId('check-vr')).toHaveAttribute('data-ok', 'false');
    await expect(page.getByTestId('vr-ready')).toContainText('Not ready');
  });

  test('VR hub: enter VR and switch experiences without leaving the session', async ({ page }) => {
    await loginAs(page, 'lea', '/vr?emulate=1');
    await expect(page.getByTestId('vr-app')).toHaveAttribute('data-scene', 'hub');
    await vr(page);
    await enterVR(page);
    await page.evaluate(() => window.__tajribaVR!.setScene('campus'));
    await expect(page.getByTestId('vr-app')).toHaveAttribute('data-scene', 'campus');
    expect(await page.evaluate(() => window.__tajribaVR?.session)).toBe('immersive-vr');
    await expect(page).toHaveURL(/scene=campus/);
  });
});

test.describe('Shadow Lab (emulated Quest 2)', () => {
  test.beforeAll(() => reseed());

  test('from the 60-second lesson into VR: move the sun, measure both shadows, find the height', async ({ page }) => {
    // the hero mission's lesson offers the lab
    await loginAs(page, 'lea', '/student/map');
    await page.getByTestId('map-node-geo.similar').click();
    await page.getByTestId('topic-sheet').getByTestId('sheet-mission').first().click();
    await page.getByTestId('mission-next').click();
    const href = await page.getByTestId('try-vr').getAttribute('href');
    expect(href).toMatch(/\/vr\?scene=shadow-lab&mission=/);

    await page.goto(`${href}&emulate=1`);
    await expect(page.getByTestId('vr-app')).toHaveAttribute('data-scene', 'shadow-lab');
    await expect.poll(() => page.evaluate(() => !!window.__tajribaVR?.lab)).toBe(true);
    await enterVR(page);

    // the lab's test actions (components/vr/scenes/shadow-lab.tsx)
    type Lab = { next(): void; setSun(deg: number): void; measure(which: 's' | 'S'): void; answer(h: number): void; height: number; choices: number[] };
    const lab = (action: keyof Lab, arg?: unknown) => page.evaluate(([a, v]) => ((window.__tajribaVR!.lab as Record<string, (x: unknown) => void>)[a as string])(v), [action, arg] as const);
    const step = () => page.evaluate(() => window.__tajribaVR!.step);

    await lab('next');
    await expect.poll(step).toBe(1);
    await lab('setSun', 35);
    await lab('setSun', 50);
    await lab('next');
    await expect.poll(step).toBe(2);
    await lab('measure', 's');
    await expect.poll(step).toBe(3);
    await lab('measure', 'S');
    await expect.poll(step).toBe(4);
    // a wrong height keeps you on the step, the right one finishes it
    const { height, choices } = await page.evaluate(() => window.__tajribaVR!.lab as Lab);
    await lab('answer', -1);
    expect(await step()).toBe(4);
    expect(choices).toContain(height);
    await lab('answer', height);
    await expect.poll(step).toBe(5);
    expect(await page.evaluate(() => window.__tajribaVR?.session)).toBe('immersive-vr');
  });
});

test.describe('VR campus with laptop classmates (emulated Quest 2)', () => {
  test.beforeAll(() => reseed());

  test('Karim walks in VR, Lea sees him on her 2D campus; he invites her from the Study Hall door and they study together', async ({ browser }) => {
    const leaCtx = await browser.newContext({ permissions: ['microphone'] });
    const lea = await leaCtx.newPage();
    await loginAs(lea, 'lea', '/student/campus');
    await expect(lea.getByTestId('campus-canvas-campus').locator('canvas')).toBeVisible();
    await expect(lea.getByTestId('campus-vr')).toHaveAttribute('href', '/vr?scene=campus');

    const karimCtx = await browser.newContext({ permissions: ['microphone'] });
    const karim = await karimCtx.newPage();
    await loginAs(karim, 'karim', '/vr?scene=campus&emulate=1');
    await expect.poll(() => karim.evaluate(() => !!(window.__tajribaVR?.campus as { pos(): unknown } | undefined)?.pos())).toBe(true);
    await enterVR(karim);

    // the same room: Lea's 2D scene shows Karim where he walked in VR
    type Campus = { pos(): { x: number; y: number }; moveBy(dx: number, dy: number): void; zone(): string | null };
    const start = await karim.evaluate(() => (window.__tajribaVR!.campus as Campus).pos());
    await karim.evaluate(() => (window.__tajribaVR!.campus as Campus).moveBy(-100, 0));
    await lea.bringToFront();
    await expect
      .poll(async () => (await lea.evaluate(() => [...(window as unknown as { __tajribaScene: { positions(): Map<string, { x: number }> } }).__tajribaScene.positions().values()].map((p) => p.x))).some((x) => Math.abs(x - (start.x - 100)) <= 2))
      .toBe(true);

    // Study Hall door → invite Lea (the VR panel's Invite button)
    await karim.bringToFront();
    await karim.evaluate(([dx, dy]) => (window.__tajribaVR!.campus as Campus).moveBy(dx, dy), [555 - (start.x - 100), 262 - start.y] as const);
    await expect.poll(() => karim.evaluate(() => (window.__tajribaVR!.campus as Campus).zone())).toBe('study_door');
    const invited = await karim.evaluate(async () => {
      const me = (await (await fetch('/api/study-sessions/classmates')).json()) as { userId: string; name: string }[];
      const lea = me.find((m) => m.name.startsWith('Lea'))!;
      const r = await fetch('/api/study-sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ partnerId: lea.userId }) });
      return ((await r.json()) as { id: string }).id;
    });
    await karim.evaluate((id) => window.__tajribaVR!.setScene(`study:${id}`), invited);
    await expect(karim.getByTestId('vr-app')).toHaveAttribute('data-scene', `study:${invited}`);
    expect(await karim.evaluate(() => window.__tajribaVR?.session)).toBe('immersive-vr');

    // Lea joins from her laptop
    await lea.bringToFront();
    await expect(lea.getByTestId('study-invite-popup')).toBeVisible();
    await lea.getByTestId('invite-join').click();
    await lea.getByTestId('join-no-mic').click();
    await expect(lea.getByTestId('partner-status')).toContainText('Karim');

    // together time runs for both, and the VR player flips the shared card
    await karim.bringToFront();
    await expect.poll(() => karim.evaluate(() => (window.__tajribaVR!.study as { togetherMs: number } | undefined)?.togetherMs ?? 0)).toBeGreaterThan(0);
    await lea.bringToFront();
    const before = await lea.getByTestId('discussion-card').innerText();
    await karim.evaluate(() => (window.__tajribaVR!.study as { nextCard(): void }).nextCard());
    await expect.poll(() => lea.getByTestId('discussion-card').innerText()).not.toBe(before);

    await lea.getByTestId('end-session').click();
    await lea.getByTestId('confirm-end').click();
    await expect(lea.getByTestId('study-ended')).toBeVisible();
    await leaCtx.close();
    await karimCtx.close();
  });
});

test.describe('VR exam room (emulated Quest 2)', () => {
  test.beforeAll(() => reseed());

  test('Bousla interviews Lea in VR; she taps, talks, taps again; the answer becomes text, she sends it, the next question comes', async ({ page }) => {
    await loginAs(page, 'lea', '/student/campus');
    const exams = (await (await page.request.get('/api/exams/mine')).json()) as { attemptId: string; title: string }[];
    const exam = exams.find((e) => e.title === 'Geometry voice check-in')!;
    // the 2D exam room offers VR
    await page.goto(`/student/exams/${exam.attemptId}`);
    await expect(page.getByTestId('exam-vr')).toHaveAttribute('href', `/vr?scene=exam:${exam.attemptId}`);

    // no `stt=server`: if the browser's own speech recognition hears nothing (headless, or failing on a headset),
    // the recording made at the same time is turned into text by Tajriba (mock AI here)
    await page.goto(`/vr?scene=exam:${exam.attemptId}&emulate=1`);
    type Exam = { start(): Promise<void>; talk(): Promise<void>; stopTalk(): Promise<void>; send(): Promise<void>; status?: string; question?: number; draft: string };
    const ex = () => page.evaluate(() => window.__tajribaVR?.exam as Exam | undefined);
    await expect.poll(async () => (await ex())?.status).toBe('NOT_STARTED');
    await enterVR(page);
    await page.evaluate(() => (window.__tajribaVR!.exam as Exam).start());
    await expect.poll(async () => (await ex())?.status).toBe('IN_PROGRESS');
    await page.evaluate(() => (window.__tajribaVR!.exam as Exam).talk());
    await page.waitForTimeout(1500); // the fake microphone plays a tone
    await page.evaluate(() => (window.__tajribaVR!.exam as Exam).stopTalk());
    await expect.poll(async () => (await ex())?.draft ?? '').toMatch(/similar triangles/i);
    await page.evaluate(() => (window.__tajribaVR!.exam as Exam).send());
    await expect.poll(async () => (await ex())?.question).toBe(1);
    expect(await page.evaluate(() => window.__tajribaVR?.session)).toBe('immersive-vr');
  });
});
