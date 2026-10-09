import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { loginAs, reseed } from './helpers';

// Fake microphone so WebRTC voice + recording run headless.
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
  permissions: ['microphone'],
});

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
    await expect(lea.page.getByTestId('recording-chip')).toBeVisible();
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

    // The replay lists the recordings and the action timeline.
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
    await expect(lea.page.getByTestId('bousla-says')).toContainText(/Bousla/);
    await expect(lea.page.getByTestId('exam-timer')).toBeVisible();

    // Ms. Rana opens the room live as a spectator.
    await rana.page.goto(examUrl);
    await rana.page.getByTestId('room-lea').getByTestId('watch-live').click();
    await expect(rana.page.getByTestId('spectating')).toBeVisible();
    await rana.page.getByTestId('listen-live').click();
    await expect(lea.page.getByTestId('observed')).toBeVisible();

    // Lea answers (typed fallback — headless has no speech recognition).
    await lea.page.getByTestId('type-instead').click();
    await lea.page.getByTestId('typed-answer').fill('It is a way to find the area: half of the base times the height of the triangle, for example a garden bed.');
    await lea.page.getByTestId('send-answer').click();
    await expect(lea.page.getByTestId('question-progress')).toContainText('2');
    await expect(lea.page.getByTestId('bousla-emoji').last()).toBeVisible();
    await expect(rana.page.getByTestId('teacher-transcript')).toContainText('garden bed');

    await lea.page.getByTestId('typed-answer').fill("I don't know");
    await lea.page.getByTestId('send-answer').click();
    await expect(lea.page.getByTestId('bousla-emoji').last()).toHaveText('💪');

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
