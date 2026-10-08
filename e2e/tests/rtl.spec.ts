import { expect, test, type Page } from '@playwright/test';
import { loginAs, reseed } from './helpers';

test.beforeAll(() => reseed());

async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width + 1);
}

test('Arabic renders RTL on student home and the mission screen', async ({ page, context, baseURL }) => {
  await loginAs(page, 'lea');
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: baseURL! }]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByTestId('greeting')).toContainText('مرحباً');
  await expectNoHorizontalOverflow(page);

  await page.getByTestId('continue-mission').click();
  await expect(page.getByTestId('mission-title')).toContainText('قِس ارتفاع مبناك بالظلال');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('mission-next').click();
  await expect(page.getByTestId('step-label')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
