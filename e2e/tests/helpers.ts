import { execSync } from 'node:child_process';
import path from 'node:path';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const FIXTURE_PHOTO = path.join(__dirname, '../fixtures/shadow.jpg');

/** Resets the demo world (idempotent seed). */
export function reseed() {
  execSync('pnpm --filter @tajriba/api db:seed', { cwd: path.join(__dirname, '../..'), stdio: 'pipe' });
}

/** One-click dev login (DEV_LOGIN=true) through the web proxy so the cookie lands on the web origin. */
export async function loginAs(page: Page, handle: string, next?: string) {
  await page.context().clearCookies();
  const res = await page.request.get(`/api/auth/dev?as=${handle}&json=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
  expect(res.ok()).toBeTruthy();
  const { redirect } = (await res.json()) as { redirect: string };
  await page.goto(redirect);
}

export async function apiAs(request: APIRequestContext, handle: string) {
  const res = await request.get(`/api/auth/dev?as=${handle}&json=1`);
  expect(res.ok()).toBeTruthy();
}

/** Drives Lea's hero mission through the API up to "Sent to Karim" (used by specs that start later in the story). */
export async function leaSubmitsHeroMission(request: APIRequestContext) {
  await apiAs(request, 'lea');
  const missions = await (await request.get('/api/missions')).json();
  const hero = missions.find((m: { key: string }) => m.key === 'm.similar.shadows');
  const sub = await (await request.post('/api/submissions', { data: { missionId: hero.id } })).json();
  const fs = await import('node:fs');
  const up = await (
    await request.post('/api/uploads', { multipart: { file: { name: 'shadow.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(FIXTURE_PHOTO) } } })
  ).json();
  await request.post(`/api/submissions/${sub.id}/submit`, {
    data: { photoUploadIds: [up.id], explanation: 'I am 1.55 m and my shadow is 2.1 m. The building shadow is 18.6 m so H = 13.7 m.', answers: { h: 1.55, s: 2.1, S: 18.6, H: 13.7 } },
  });
  const routed = await (await request.post(`/api/submissions/${sub.id}/follow-up`, { data: { answer: 'No, both shadows grow by the same ratio so the height stays the same.' } })).json();
  return routed as { id: string; status: string };
}
