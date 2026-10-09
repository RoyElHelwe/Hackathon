import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { loginAs, reseed } from './helpers';

// Fake microphone so WebRTC voice + recording run headless.
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
  permissions: ['microphone'],
});

declare global {
  interface Window {
    /** dev-only scene handle (campus-canvas.tsx) */
    __tajribaScene?: { walkTo(x: number, y: number): void };
  }
}

/** Walks the avatar to a map point, like tapping the floor there (spawn points differ per user). */
async function walkTo(page: Page, x: number, y: number) {
  await page.bringToFront(); // background tabs barely animate
  await expect.poll(() => page.evaluate(() => !!window.__tajribaScene)).toBe(true);
  await page.evaluate(([px, py]) => window.__tajribaScene!.walkTo(px, py), [x, y] as const);
}

async function userPage(browser: Browser, handle: string, next?: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, handle, next);
  return { ctx, page };
}

test.describe('Tajriba Campus', () => {
  test.beforeAll(() => reseed());

  test('peer study session: invite → both in the 2D room with voice → recorded → End', async ({ browser }) => {
    const lea = await userPage(browser, 'lea');
    const karim = await userPage(browser, 'karim');
    await lea.page.goto('/student/campus');
    await karim.page.goto('/student/campus');
    await expect(lea.page.getByTestId('campus-canvas-campus').locator('canvas')).toBeVisible();
    await expect(lea.page.getByTestId('campus-online')).toContainText(/1/);

    // Lea invites Karim and enters the study room.
    await lea.page.getByTestId('classmate-karim').getByTestId('invite-classmate').click();
    await lea.page.waitForURL(/\/student\/study\//);
    await lea.page.getByTestId('join-voice').click();
    await expect(lea.page.getByTestId('study-room')).toBeVisible();

    // Karim gets a live pop-up and joins.
    await expect(karim.page.getByTestId('study-invite-popup')).toBeVisible();
    await karim.page.getByTestId('invite-join').click();
    await karim.page.waitForURL(/\/student\/study\//);
    await karim.page.getByTestId('join-voice').click();
    await expect(karim.page.getByTestId('study-room')).toBeVisible();

    await expect(lea.page.getByTestId('partner-status')).toContainText('Karim');
    await expect(karim.page.getByTestId('partner-status')).toContainText('Lea');
    // voices are recorded only when the server turns it on (RECORD_STUDY_SESSIONS); the page follows /auth/config
    const records = ((await (await lea.page.request.get('/api/auth/config')).json()) as { recordStudySessions?: boolean }).recordStudySessions === true;
    if (records) await expect(lea.page.getByTestId('recording-chip')).toBeVisible();
    await expect(lea.page.getByTestId('together-chip')).toBeVisible();
    await expect(lea.page.getByTestId('discussion-card')).toBeVisible();
    await karim.page.getByTestId('emote-dance').click();
    await lea.page.getByTestId('next-card').click();

    // Karim reloads (network blip): the session must keep going for Lea.
    await karim.page.reload();
    await karim.page.getByTestId('join-voice').click();
    await expect(karim.page.getByTestId('study-room')).toBeVisible();
    await expect(lea.page.getByTestId('study-room')).toBeVisible();

    await lea.page.waitForTimeout(11_000); // at least one 10 s recording chunk
    await lea.page.getByTestId('end-session').click();
    await lea.page.getByTestId('confirm-end').click();
    await expect(lea.page.getByTestId('study-ended')).toBeVisible();
    await expect(karim.page.getByTestId('study-ended')).toBeVisible();

    // The replay lists the recordings (when recorded) and the action timeline.
    if (records)
      await expect
        .poll(async () => {
          await lea.page.reload();
          await lea.page.getByTestId('recording').first().waitFor({ timeout: 5000 }).catch(() => undefined);
          return lea.page.getByTestId('recording').count();
        }, { timeout: 30_000 })
        .toBeGreaterThan(0);
    await expect(lea.page.getByTestId('timeline')).toContainText(/entered the room|emote/);
    await lea.ctx.close();
    await karim.ctx.close();
  });

  test('campus: walking keeps the page still; Arzino, the doors and a classmate card all lead somewhere', async ({ browser }) => {
    const lea = await userPage(browser, 'lea', '/student/campus');
    await expect(lea.page.getByTestId('campus-canvas-campus').locator('canvas')).toBeVisible();
    await expect.poll(() => lea.page.evaluate(() => !!window.__tajribaScene)).toBe(true);

    // arrow keys walk the avatar, they don't scroll the page
    await lea.page.keyboard.down('ArrowDown');
    await lea.page.waitForTimeout(400);
    await lea.page.keyboard.up('ArrowDown');
    expect(await lea.page.evaluate(() => window.scrollY)).toBe(0);

    // Arzino points to the next mission
    await walkTo(lea.page, 800, 268);
    await expect(lea.page.getByTestId('arzino-go')).toBeVisible();
    // the Exam Wing door opens the exam room that is open now
    await walkTo(lea.page, 1045, 262);
    await expect(lea.page.getByTestId('door-enter-exam').first()).toBeVisible();
    // the Study Hall door lists classmates to invite
    await walkTo(lea.page, 555, 262);
    await expect(lea.page.getByTestId('door-invite-omar')).toBeVisible();

    // Omar walks up to Lea → "say hi" → his card → invite
    await walkTo(lea.page, 800, 330);
    const omar = await userPage(browser, 'omar', '/student/campus');
    await expect(omar.page.getByTestId('campus-canvas-campus').locator('canvas')).toBeVisible();
    await walkTo(omar.page, 850, 330);
    await omar.page.waitForTimeout(2500);
    await lea.page.bringToFront();
    await lea.page.getByTestId('near-chip').click();
    await expect(lea.page.getByTestId('player-card')).toContainText('Omar');
    await lea.page.getByTestId('player-invite').click();
    await expect(lea.page).toHaveURL(/\/student\/study\//);

    // "Not now" really declines, so Lea isn't left waiting
    await omar.page.bringToFront();
    await omar.page.getByTestId('invite-decline').click();
    await lea.page.bringToFront();
    await expect(lea.page.getByTestId('study-ended')).toContainText('Declined');
    await lea.ctx.close();
    await omar.ctx.close();
  });

  test('"I\'m stuck → Ask a friend": the classmate who mastered it joins a room with the mission on the board', async ({ browser }) => {
    const lea = await userPage(browser, 'lea', '/student/map');
    const karim = await userPage(browser, 'karim', '/student');
    await lea.page.getByTestId('map-node-geo.similar').click();
    await lea.page.getByTestId('topic-sheet').getByTestId('sheet-mission').first().click();
    await lea.page.getByTestId('mission-next').click();
    await lea.page.getByTestId('mission-next').click();
    for (let i = 1; i <= 3; i++) {
      await lea.page.getByTestId('im-stuck').click();
      await expect(lea.page.getByTestId('hint-text')).toHaveCount(i);
    }
    // Karim mastered similar triangles: he is offered first
    await lea.page.getByTestId('ask-friend-karim').click();
    await expect(lea.page).toHaveURL(/\/student\/study\//);

    await karim.page.bringToFront();
    await expect(karim.page.getByTestId('study-invite-popup')).toContainText('help');
    await karim.page.getByTestId('invite-join').click();
    await karim.page.waitForURL(/\/student\/study\//);
    await karim.page.getByTestId('join-no-mic').click();
    await expect(karim.page.getByTestId('helping-with')).toContainText('Measure your building with shadows');
    await expect(karim.page.getByTestId('mission-on-board')).toBeVisible();

    // the discussion card on the board is the same for both partners
    await lea.page.bringToFront();
    await lea.page.getByTestId('join-no-mic').click();
    await expect(lea.page.getByTestId('study-room')).toBeVisible();
    await lea.page.getByTestId('board-cards').click();
    await karim.page.getByTestId('board-cards').click();
    const first = await lea.page.getByTestId('discussion-card').innerText();
    await karim.page.getByTestId('next-card').click();
    await expect(lea.page.getByTestId('discussion-card')).not.toHaveText(first);
    const karimCard = await karim.page.getByTestId('discussion-card').innerText();
    await expect.poll(() => lea.page.getByTestId('discussion-card').innerText()).toBe(karimCard);

    await lea.page.getByTestId('end-session').click();
    await lea.page.getByTestId('confirm-end').click();
    await expect(lea.page.getByTestId('study-ended')).toBeVisible();
    await lea.ctx.close();
    await karim.ctx.close();
  });

  test('AI interview exam: teacher creates from lessons → student answers in a private room → teacher watches live → approves', async ({ browser }) => {
    const rana = await userPage(browser, 'rana');
    await rana.page.goto('/teacher/exams/new');
    await rana.page.getByTestId('exam-class').selectOption({ label: '8B Math' });
    await rana.page.getByTestId('lesson-option').first().click();
    await rana.page.getByTestId('exam-title').fill('E2E voice interview');
    await rana.page.getByTestId('create-exam').click();
    await rana.page.waitForURL(/\/teacher\/exams\/(?!new)[^/]+$/);
    await expect(rana.page.getByTestId('question-list')).toBeVisible();
    await rana.page.getByTestId('publish-exam').click();
    await rana.page.getByTestId('confirm-publish').click();
    await expect(rana.page.getByTestId('room-grid')).toBeVisible();
    const examUrl = rana.page.url();

    // Lea enters her private room.
    const lea = await userPage(browser, 'lea');
    await lea.page.goto('/student/campus');
    const card = lea.page.getByTestId('exam-room-card').filter({ hasText: 'E2E voice interview' });
    await card.getByTestId('enter-exam-room').click();
    await lea.page.getByTestId('start-interview').click();
    await expect(lea.page.getByTestId('exam-room')).toBeVisible();
    await expect(lea.page.getByTestId('arzino-says')).toContainText(/Arzino/);
    await expect(lea.page.getByTestId('exam-timer')).toBeVisible();

    // Ms. Rana opens the room live as a spectator.
    await rana.page.goto(examUrl);
    await rana.page.getByTestId('room-lea').getByTestId('watch-live').click();
    await expect(rana.page.getByTestId('spectating')).toBeVisible();
    await expect(lea.page.getByTestId('observed')).toBeVisible();
    // "Listen" now really connects: Lea is told her teacher is listening.
    await rana.page.getByTestId('listen-live').click();
    await expect(lea.page.getByTestId('teacher-listening')).toContainText('Rana');

    // Lea answers (typed fallback — headless has no speech recognition).
    await lea.page.getByTestId('type-instead').click();
    await lea.page.getByTestId('typed-answer').fill('It is a way to find the area: half of the base times the height of the triangle, for example a garden bed.');
    await lea.page.getByTestId('send-answer').click();
    await expect(lea.page.getByTestId('question-progress')).toContainText('2');
    await expect(lea.page.getByTestId('arzino-emoji').last()).toBeVisible();
    await expect(rana.page.getByTestId('teacher-transcript')).toContainText('garden bed');

    // The Exam Hall: one glass room per student; jumping into Lea's room = hearing it + seeing her transcript.
    const attemptUrl = rana.page.url();
    await rana.page.goto(examUrl);
    await rana.page.getByTestId('open-hall').click();
    await expect(rana.page.getByTestId('campus-canvas-hall')).toBeVisible();
    await expect(rana.page.getByTestId('hall-rooms')).toContainText('Karim');
    await rana.page.getByTestId('hall-audio').click();
    await expect(async () => {
      await rana.page.getByTestId('hall-row-lea').click();
      await expect(rana.page.getByTestId('hall-focus')).toContainText('Lea', { timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await expect(rana.page.getByTestId('hall-panel')).toContainText('garden bed');
    await expect(lea.page.getByTestId('teacher-listening')).toBeVisible();
    // walking to another room stops listening to Lea
    await rana.page.getByTestId('hall-row-karim').click();
    await expect(rana.page.getByTestId('hall-focus')).toContainText('Karim');
    await expect(lea.page.getByTestId('teacher-listening')).toHaveCount(0);
    await rana.page.goto(attemptUrl);

    await lea.page.getByTestId('typed-answer').fill("I don't know");
    await lea.page.getByTestId('send-answer').click();
    await expect(lea.page.getByTestId('arzino-emoji').last()).toHaveText('💪');

    await lea.page.getByTestId('finish-interview').click();
    await lea.page.getByTestId('confirm-finish').click();
    await expect(lea.page.getByTestId('exam-done')).toBeVisible();

    // Teacher reviews and releases; only then Lea sees her score.
    await expect(rana.page.getByTestId('exam-review')).toBeVisible();
    await rana.page.getByTestId('override-score').fill('82');
    await rana.page.getByTestId('approve-release').click();
    await expect(rana.page.getByTestId('exam-review')).toContainText('Released');
    await lea.page.reload();
    await expect(lea.page.getByTestId('exam-result')).toContainText('82');
    await lea.ctx.close();
    await rana.ctx.close();
  });
});
