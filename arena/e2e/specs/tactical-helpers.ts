import { expect, type Page, type TestInfo } from '@playwright/test';
import { performMapAction } from '../../tools/browser-map.mjs';

export const enabled = process.env.ARENA_V070_ACCEPTANCE === '1';
export const bar = (page: Page) => page.getByRole('region', { name: '战术行动', exact: true });
export const point = (s: any) => s.tactics.controlPoints.find((p: any) => p.roomId === 'room-2');
export const actor = (s: any, id: string) => s.actors.find((a: any) => a.id === id);
export const at = (s: any, id: string, room: string) => actor(s, id)?.roomId === room && !actor(s, id)?.travel;
export const claimEvent = (s: any, phase: string, owner?: string) => s.events.findLast((e: any) =>
  e.tactical?.action === 'claim' && e.tactical.phase === phase && e.tactical.targetId === 'room-2' &&
  (!owner || e.tactical.values.ownerId === owner));

export function sixTickCapture(s: any, captured: any) {
  const stages = s.events.filter((e: any) => e.tactical?.actorId === captured.tactical.actorId &&
    e.tactical?.action === 'claim' && e.tick > captured.tick - 6 && e.tick <= captured.tick &&
    ['progress', 'captured'].includes(e.tactical.phase));
  expect(stages.map((e: any) => e.tick)).toEqual(Array.from({ length: 6 }, (_, i) => captured.tick - 5 + i));
  expect(stages.map((e: any) => e.tactical.values.progressTicks)).toEqual([1, 2, 3, 4, 5, 6]);
}

/** API observes the authenticated page's world; all mutations below use visible UI. */
export async function state(page: Page) {
  return page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem('arena-session')!);
    const response = await fetch(`/api/sessions/${auth.sessionId}/state`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!response.ok) throw new Error(`State read ${response.status}`);
    return response.json();
  });
}
export async function until(page: Page, predicate: (s: any) => boolean, timeout = 45000) {
  let observed: any;
  await expect.poll(async () => {
    observed = await state(page);
    return predicate(observed);
  }, { timeout, intervals: [80] }).toBe(true);
  return observed;
}
export async function training(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '开启战术演练', exact: true }).click();
  await expect(bar(page)).toBeVisible();
  const s = await state(page);
  expect(s.mode).toBe('training');
  expect(s.scenarioId).toBe('seal-contest');
  expect(s.paused).toBe(true);
}
export async function move(page: Page, room: string) {
  await performMapAction(page, { type: 'selectRoom', room });
  await performMapAction(page, { type: 'moveToRoom' });
  await page.getByRole('button', { name: '关闭房间详情', exact: true }).click();
}
export async function selectClaim(page: Page) {
  await bar(page).getByLabel('战术行动', { exact: true }).selectOption('claim');
  await bar(page).getByLabel('战术目标', { exact: true }).selectOption('room-2');
}
export async function claim(page: Page) {
  await selectClaim(page);
  await bar(page).getByRole('button', { name: '确认占领', exact: true }).click();
}
export async function prepareDeparture(page: Page) {
  await performMapAction(page, { type: 'selectRoom', room: 'room-0' });
  return page.getByRole('button', { name: '派遣选中角色', exact: true });
}
export async function keyboardDeparture(page: Page, id: string) {
  const response = page.waitForResponse(r => r.url().endsWith('/commands') &&
    r.request().method() === 'POST' && r.request().postDataJSON()?.type === 'move');
  await page.keyboard.press('Enter');
  const result = await response;
  expect(result.status()).toBe(200);
  expect(result.request().postDataJSON()).toEqual({ type: 'move', actorId: id, roomId: 'room-0' });
  return result.json();
}
export async function evidence(page: Page, info: TestInfo, name: string, facts: unknown) {
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
  await info.attach(name, { body: JSON.stringify(facts, null, 2), contentType: 'application/json' });
}
export function errors(page: Page) {
  const found: string[] = [];
  page.on('pageerror', error => found.push(error.message));
  return found;
}
