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
