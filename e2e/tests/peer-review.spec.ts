import { expect, test } from '@playwright/test';
import { leaSubmitsHeroMission, loginAs, reseed } from './helpers';

let submissionId = '';

test.beforeAll(async ({ request }) => {
  reseed();
  const sub = await leaSubmitsHeroMission(request);
  expect(sub.status).toBe('PEER_REVIEW');
  submissionId = sub.id;
});

test('Karim completes the review → Lea is validated, levels up and unlocks a new node', async ({ page }) => {
  await loginAs(page, 'karim');
  await expect(page.getByTestId('reviews-waiting')).toBeVisible();
  await page.getByTestId('tab-reviews').click();
  await page.getByTestId('review-card').first().click();

  await expect(page.getByTestId('peer-photo').first()).toBeVisible();
  const items = page.getByTestId('checklist-item');
  const count = await items.count();
  for (let i = 0; i < count; i++) await items.nth(i).getByTestId('check-ok').click();
  await page.getByTestId('peer-comment').fill('Great measuring! You did both shadows at the same time.');
  await page.getByTestId('complete-review').click();
  await expect(page.getByTestId('review-reward')).toContainText('+15');

  // Lea sees the validation with rewards
  await loginAs(page, 'lea', `/student/submissions/${submissionId}`);
  await expect(page.getByTestId('validated-stamp')).toBeVisible();
  await expect(page.getByTestId('floating-xp')).toBeVisible();
  // badge flip then level-up modal (Lea goes from level 2 to 3)
  await expect(page.getByTestId('badge-earned')).toBeVisible();
  await page.getByTestId('badge-earned').getByRole('button').click();
  await expect(page.getByTestId('level-up')).toBeVisible();
  await expect(page.getByTestId('level-up')).toContainText('3');
  await page.getByTestId('level-up').getByRole('button').click();

  // A new node unlocks on the map
  await page.getByTestId('see-map').click();
  await expect(page.getByTestId('unlock-toast')).toBeVisible();
  await expect(page.getByTestId('map-node-geo.similar')).toHaveAttribute('data-state', 'MASTERED');
  await expect(page.getByTestId('map-node-geo.pythagoras')).toHaveAttribute('data-state', 'AVAILABLE');
});
