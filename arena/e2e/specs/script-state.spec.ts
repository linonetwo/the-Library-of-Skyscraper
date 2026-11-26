import { openMenu, closeOverlay, stepTraining } from './hud-helpers';
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

test('memory gather displays persistent counter, task queue and pure preview', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByRole('button', { name: '开启训练远征' }).click();
  await openMenu(page, 'AI 模块编辑');
  await page.getByRole('tab', { name: 'TypeScript', exact: true }).click();
  await page.getByLabel('载入规则模板').selectOption('memory-gather');
  await page.getByRole('button', { name: '发布到战场' }).click();
  const state = () => page.evaluate(async () => {
    const auth = JSON.parse(sessionStorage.getItem('arena-session')!);
    const response = await fetch('/api/sessions/' + auth.sessionId + '/scripts/state', { headers: { Authorization: 'Bearer ' + auth.token } });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });
  await expect.poll(async () => (await state()).sourceHash).toBeTruthy();
  await stepTraining(page);
  await expect.poll(async () => (await state()).memory.ticks).toBe(1);
  await expect(page.getByLabel('规则记忆')).toContainText('"ticks": 1');
  await expect(page.getByLabel('规则任务队列').getByRole('listitem')).toHaveCount(3);
  const before = await state();
  await page.getByRole('button', { name: '试跑当前快照' }).click();
  await expect(page.getByLabel('试跑状态补丁')).toBeVisible();
  expect(await state()).toEqual(before);
  await stepTraining(page);
  await expect.poll(async () => (await state()).memory.ticks).toBe(2);
  await expect(page.getByLabel('规则记忆')).toContainText('"ticks": 2');
  if (process.env.ARENA_CAPTURE_DAY) {
    const name = '竞技场' + process.env.ARENA_CAPTURE_DAY + '规则记忆任务实机.png';
    const destination = path.resolve('../../wiki/tiddlers', name);
    await page.getByLabel('规则记忆').scrollIntoViewIfNeeded();
    await page.screenshot({ path: destination, fullPage: true });
    await writeFile(destination + '.meta', 'title: ' + name + '\ntype: image/png\n');
  }
});

test('slow online state responses render and changing sessions clears old memory', async ({ page }) => {
  test.setTimeout(60000);
  let originalSession = '';
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let holdNew = false;
  await page.route('**/api/sessions/*/scripts/state', async route => {
    const isNew = holdNew && !route.request().url().includes('/' + originalSession + '/');
    if (isNew) await held;
    else await new Promise(resolve => setTimeout(resolve, 750));
    await route.continue();
  });
  await page.goto('/');
  await openMenu(page, '联机大厅');
  await page.getByRole('button', { name: /创建联机/ }).click();
  await openMenu(page, 'AI 模块编辑');
  await page.getByRole('tab', { name: 'TypeScript', exact: true }).click();
  await page.getByLabel('载入规则模板').selectOption('memory-gather');
  await page.getByRole('button', { name: '发布到战场' }).click();
  await expect(page.getByLabel('规则记忆')).toContainText('"ticks":', { timeout: 20000 });
  originalSession = await page.evaluate(() => JSON.parse(sessionStorage.getItem('arena-session')!).sessionId);
  const first = await page.getByLabel('规则记忆').innerText();
  await expect.poll(() => page.getByLabel('规则记忆').innerText(), { timeout: 15000 }).not.toBe(first);
  holdNew = true;
  await openMenu(page, '联机大厅');
  await page.getByRole('dialog', { name: '赛局入口' }).getByRole('button', { name: /本地训练/ }).click();
  await openMenu(page, 'AI 模块编辑');
  await page.getByRole('tab', { name: 'TypeScript', exact: true }).click();
  await expect(page.getByRole('region', { name: '规则运行状态' })).toContainText('正在展开策略笔记');
  await expect(page.getByLabel('规则记忆')).toHaveCount(0);
  release();
  await expect(page.getByLabel('规则记忆')).toHaveText('{}');
});
