import { expect, test } from '@playwright/test';
import { loginAs, reseed } from './helpers';

test.beforeAll(() => reseed());

test('Mona sees the weekly summary and confirms the family mission', async ({ page }) => {
  await loginAs(page, 'mona');
  await expect(page).toHaveURL(/\/parent/);
  // Mona's language is Arabic
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('weekly-summary')).toBeVisible();
  await expect(page.getByTestId('summary-highlight').first()).toBeVisible();
  await expect(page.getByTestId('work-photo').first()).toBeVisible();

  await page.goto('/parent/family');
  const card = page.getByTestId('family-mission-card').first();
  await expect(card).toBeVisible();
  await card.getByTestId('family-note').fill('استمتعنا كثيراً بالقياس معاً!');
  await card.getByTestId('confirm-family-mission').click();
  await expect(page.getByTestId('family-confirmed')).toBeVisible();
});
