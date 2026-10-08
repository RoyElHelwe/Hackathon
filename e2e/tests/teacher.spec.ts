import { expect, test } from '@playwright/test';
import { loginAs, reseed } from './helpers';

test.beforeAll(() => reseed());

test('Rana: heatmap shows Omar stuck → AI group session → generate missions → approve & publish', async ({ page }) => {
  await loginAs(page, 'rana');
  await expect(page).toHaveURL(/\/teacher/);
  await page.getByTestId('class-card').filter({ hasText: '8B Math' }).click();

  await expect(page.getByTestId('heatmap')).toBeVisible();
  await expect(page.getByTestId('heatmap-row').filter({ hasText: 'Omar' })).toBeVisible();
  await expect(page.getByTestId('stuck-alert').filter({ hasText: 'Omar' })).toBeVisible();
  await page.getByTestId('plan-group-session').click();
  await expect(page.getByTestId('group-session-plan')).toBeVisible();
  await page.keyboard.press('Escape');

  // Mission studio
  await page.goto('/teacher/missions');
  await page.getByTestId('topic-chip-geo.angles').click();
  await page.getByTestId('generate-missions').click();
  await expect(page.getByTestId('mission-draft-card')).toHaveCount(3);
  const card = page.getByTestId('mission-draft-card').first();
  await expect(card.getByTestId('safety-badge')).toHaveAttribute('data-safe', 'true');
  await card.getByTestId('approve-publish').click();
  await page.getByTestId('confirm-publish').click();
  await expect(card.getByTestId('published-badge')).toBeVisible();
  await expect(card.getByTestId('posted-to-classroom')).toBeVisible();
});
