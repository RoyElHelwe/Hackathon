import { expect, test } from '@playwright/test';
import { FIXTURE_PHOTO, loginAs, reseed } from './helpers';

test.beforeAll(() => reseed());

test('Lea: map → hero mission → photo + explanation → follow-up → sent to Karim', async ({ page }) => {
  await loginAs(page, 'lea');
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByTestId('greeting')).toContainText('Lea');

  // Skill map: similar triangles is available, Pythagoras locked
  await page.getByTestId('tab-map').click();
  await expect(page.getByTestId('skill-map')).toBeVisible();
  await expect(page.getByTestId('map-node-geo.similar')).toHaveAttribute('data-state', 'AVAILABLE');
  await expect(page.getByTestId('map-node-geo.area')).toHaveAttribute('data-state', 'MASTERED');
  await expect(page.getByTestId('map-node-geo.pythagoras')).toHaveAttribute('data-state', 'LOCKED');
  await page.getByTestId('map-node-geo.similar').click();
  await page.getByTestId('topic-sheet').getByTestId('sheet-mission').first().click();

  // Stepper: story → lesson → mission → proof
  await expect(page.getByTestId('mission-title')).toContainText('Measure your building with shadows');
  await page.getByTestId('mission-next').click();
  await expect(page.getByTestId('step-label')).toContainText('2/4');
  await page.getByTestId('mission-next').click();
  await expect(page.getByTestId('safety-chip')).toBeVisible();

  // I'm stuck → hint 1
  await page.getByTestId('im-stuck').click();
  await expect(page.getByTestId('hint-text').first()).toBeVisible();

  await page.getByTestId('mission-next').click();
  await expect(page.getByTestId('step-label')).toContainText('4/4');
  await page.getByTestId('photo-input').setInputFiles(FIXTURE_PHOTO);
  await expect(page.locator('img[src^="/api/uploads/"]').first()).toBeVisible();
  await page.getByTestId('field-h').fill('1.55');
  await page.getByTestId('field-s').fill('2.1');
  await page.getByTestId('field-S').fill('18.6');
  await page.getByTestId('field-H').fill('13.7');
  await page.getByTestId('explanation').fill('I am 1.55 m tall and my shadow was 2.1 m. The building shadow was 18.6 m, so H = 18.6 × 1.55 ÷ 2.1 = 13.7 m.');
  await page.getByTestId('submit-proof').click();

  // AI check + mandatory follow-up
  await expect(page.getByTestId('score-dial')).toBeVisible();
  await expect(page.getByTestId('follow-up-question')).toBeVisible();
  await page.getByTestId('follow-up-answer').fill('No — both shadows get longer by the same ratio, so h/s and H/S stay equal.');
  await page.getByTestId('send-follow-up').click();

  await expect(page.getByTestId('sent-to-peer')).toContainText('Karim');
});
