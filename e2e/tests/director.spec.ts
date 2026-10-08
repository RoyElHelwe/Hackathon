import { expect, test } from '@playwright/test';
import { loginAs, reseed } from './helpers';

test.beforeAll(() => reseed());

test('director approves the pending teacher; coverage matrix renders', async ({ page }) => {
  await loginAs(page, 'director');
  await expect(page).toHaveURL(/\/director/);
  await expect(page.getByTestId('kpi-active')).toBeVisible();
  await expect(page.getByTestId('school-code')).toContainText('TRP-2036');

  await page.goto('/director/members');
  const row = page.getByTestId('pending-member').filter({ hasText: 'Nadine' });
  await expect(row).toBeVisible();
  await row.getByTestId('approve-member').click();
  await expect(page.getByTestId('pending-member').filter({ hasText: 'Nadine' })).toHaveCount(0);

  await page.goto('/director/coverage');
  await expect(page.getByTestId('coverage-matrix')).toBeVisible();
  await expect(page.getByTestId('coverage-row').first()).toBeVisible();
  expect(await page.getByTestId('coverage-cell').count()).toBeGreaterThan(5);
});
