import { openMenu, closeOverlay, stepTraining } from './hud-helpers';
import { test, expect, type Page } from '@playwright/test';
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
  await openMenu(page, '训练控制');
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeVisible();
}

test('single player: atlas, rule publication, tick control and real screenshot', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await training(page);
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button',{name:'角色详情',exact:true}).click();
  await expect(page.locator('.portrait-frame [role=img]')).toHaveCount(1);
  await page.getByRole('button', { name: '书库守卫', exact: true }).click();
  await page.getByRole('button', { name: '墨蓝发色' }).click();
  await expect(page.locator('.portrait-frame .paper-doll')).toHaveClass(/warden/);
  await expect(page.getByRole('button', { name: '墨蓝发色' })).toHaveClass(/selected/);
  const before = await state(page);
  await stepTraining(page);
  await expect.poll(async () => (await state(page)).tick).toBe(before.tick + 1);
  await openMenu(page, '行动规则');
  await page.getByRole('button', { name: /02守卫书库|02 守卫书库/ }).click();
  await page.getByLabel('生命值撤退阈值').fill('45');
  await page.getByRole('button', { name: '确认并发布规则' }).click();
  await expect.poll(async () => (await state(page)).players[0].rule).toEqual({ preset: 'defend', retreatHp: 45 });
  await closeOverlay(page);
  await page.getByRole('button',{name:'全图总览',exact:true}).click();
  const camera=JSON.parse((await page.locator('.pixi-map').getAttribute('data-camera'))!);
  const target=JSON.parse((await page.locator('.pixi-map').getAttribute('data-room-targets'))!)[0];
  await page.locator('canvas').click({position:{x:target.x*camera.scale+camera.x,y:target.y*camera.scale+camera.y}});
  await expect(page.getByRole('button', { name: '建造哨塔' })).toBeVisible();
  await page.getByRole('button', { name: '关闭房间详情' }).click();
  await expect(page.locator(".pixi-map")).toHaveAttribute("data-actors",/worldPosition/);
  expect(errors).toEqual([]);
});

test('two independent browsers join a live room and reconnect with same player', async ({ browser }) => {
  test.setTimeout(60000); // Two live software-rendered maps, wardrobe updates and both reconnects.
  const first = await browser.newContext();
  const second = await browser.newContext();
  const host = await first.newPage();
  const guest = await second.newPage();
  await host.goto('/');
  await openMenu(host, '联机大厅');
  await host.getByRole('button', { name: /创建联机/ }).click();
  await expect.poll(async () => (await state(host))?.mode).toBe('online');
  const hostState = await state(host);
  await guest.goto('/');
  await openMenu(guest, '联机大厅');
  await guest.getByLabel('使用赛局编号加入').fill(hostState.sessionId);
  await guest.getByRole('button', { name: '加入赛局', exact: true }).click();
  await expect.poll(async () => (await state(guest))?.players.length).toBe(2);
  await expect.poll(async () => (await state(host)).players.length).toBe(2);
  const identities = await Promise.all([host, guest].map(p => p.evaluate(() =>
    JSON.parse(sessionStorage.getItem('arena-session')!).playerId)));
  expect(identities[0]).not.toBe(identities[1]);
  await host.getByRole('button', {name:'角色详情',exact:true}).click();
  await host.getByRole('button', { name: '书库守卫', exact: true }).click();
  await host.getByRole('button', { name: '墨蓝发色' }).click();
  await host.getByLabel('携带法杖').click();
  await expect(host.getByLabel('携带法杖')).not.toBeChecked();
  const equippedId = hostState.actors.find(
    (actor: { owner: string }) => actor.owner === identities[0]).id;
  const appearance = { outfit: 'warden', hair: 'midnight', weapon: false };
  await expect.poll(async () =>
    (await state(guest)).actors.find((actor: { id: string }) => actor.id === equippedId).appearance,
  ).toEqual(appearance);
  await host.reload();
  await host.getByRole('button',{name:'角色详情',exact:true}).click();
  await expect(host.locator('.portrait-frame .paper-doll')).toHaveClass(/warden/);
  await expect(host.getByRole('button', { name: '墨蓝发色' })).toHaveClass(/selected/);
  await expect(host.getByLabel('携带法杖')).not.toBeChecked();
  const timeline = await host.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem('arena-session')!);
    return fetch(`/api/sessions/${auth.sessionId}/replay/timeline`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    }).then(response => response.json());
  });
  expect(timeline.frames.at(-1).snapshot.actors.find(
    (actor: { id: string }) => actor.id === equippedId).appearance).toEqual(appearance);
  await expect(guest.getByRole('button', { name: '暂停', exact: true })).toHaveCount(0);
  const tick = (await state(guest)).tick;
  await guest.reload();
  await expect.poll(async () => (await state(guest)).tick).toBeGreaterThan(tick);
  expect(await guest.evaluate(() => JSON.parse(sessionStorage.getItem('arena-session')!).playerId)).toBe(identities[1]);
  await first.close();
  await second.close();
});

test('narrow layout presents the paper-doll squad', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await training(page);
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button',{name:'角色详情',exact:true}).click();
  await expect(page.locator('.portrait-frame [role=img]')).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  expect(overflow).toBe(false);
});
