import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const evidence = path.resolve(import.meta.dirname, '../../../wiki/tiddlers');
async function state(page: Page) {
  return page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem('arena-session')!);
    if (!auth) return null;
    return fetch(`/api/sessions/${auth.sessionId}/state`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    }).then(r => r.json());
  });
}
async function training(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '开启训练远征' }).click();
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeVisible();
}

test('single player: atlas, rule publication, tick control and real screenshot', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await training(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.portrait-frame .doll-layer')).toHaveCount(4);
  await page.getByRole('button', { name: '书库守卫', exact: true }).click();
  await page.getByRole('button', { name: '墨蓝发色' }).click();
  await expect(page.locator('.portrait-frame .paper-doll')).toHaveClass(/warden/);
  await expect(page.getByRole('button', { name: '墨蓝发色' })).toHaveClass(/selected/);
  const before = await state(page);
  await page.getByRole('button', { name: '单步', exact: true }).click();
  await expect.poll(async () => (await state(page)).tick).toBe(before.tick + 1);
  await page.getByRole('button', { name: '行动规则', exact: true }).click();
  await page.getByRole('button', { name: /02守卫书库|02 守卫书库/ }).click();
  await page.getByLabel('生命值撤退阈值').fill('45');
  await page.getByRole('button', { name: '确认并发布规则' }).click();
  await expect.poll(async () => (await state(page)).players[0].rule).toEqual({ preset: 'defend', retreatHp: 45 });
  await page.getByRole('button', { name: '战场总览' }).click();
  await page.getByLabel('定位地图房间').selectOption('room-0');
  await expect(page.getByRole('button', { name: '建造哨塔' })).toBeVisible();
  await page.getByRole('button', { name: '关闭房间详情' }).click();
  await page.screenshot({ path: path.join(evidence, '竞技场实机2026-10-27.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('two independent browsers join a live room and reconnect with same player', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const host = await first.newPage();
  const guest = await second.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: '联机大厅', exact: true }).click();
  await host.getByRole('button', { name: /创建联机/ }).click();
  await expect.poll(async () => (await state(host))?.mode).toBe('online');
  const hostState = await state(host);
  await guest.goto('/');
  await guest.getByRole('button', { name: '联机大厅', exact: true }).click();
  await guest.getByLabel('使用赛局编号加入').fill(hostState.sessionId);
  await guest.getByRole('button', { name: '加入赛局', exact: true }).click();
  await expect.poll(async () => (await state(guest))?.players.length).toBe(2);
  await expect.poll(async () => (await state(host)).players.length).toBe(2);
  const identities = await Promise.all([host, guest].map(p => p.evaluate(() =>
    JSON.parse(sessionStorage.getItem('arena-session')!).playerId)));
  expect(identities[0]).not.toBe(identities[1]);
  await expect(guest.getByRole('button', { name: '暂停', exact: true })).toHaveCount(0);
  const tick = (await state(guest)).tick;
  await guest.reload();
  await expect.poll(async () => (await state(guest)).tick).toBeGreaterThan(tick);
  expect(await guest.evaluate(() => JSON.parse(sessionStorage.getItem('arena-session')!).playerId)).toBe(identities[1]);
  await first.close();
  await second.close();
});

test('narrow layout and missing textures remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/assets/**', route => route.abort());
  await training(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.portrait-frame .doll-fallback')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  expect(overflow).toBe(false);
});
