import { openMenu, closeOverlay, stepTraining } from './hud-helpers';
import { test, expect } from '@playwright/test';

test('live and replay canvases keep independent rendering lifetimes', async ({ page }, testInfo) => {
  test.setTimeout(60000); // Two replay canvases and screenshots also run under CI software rendering.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '开启训练远征' }).click();
  await openMenu(page, '训练控制');
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeEnabled();
  for (let step = 0; step < 8; step++) {
    await stepTraining(page);
  }
  await openMenu(page, '赛局日志');
  for (let opening = 0; opening < 2; opening++) {
    await page.getByRole('button', { name: '播放赛局回放' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('canvas')).toBeVisible();
    const progress = page.getByRole('slider', { name: '回放进度' });
    await progress.fill("0");
    await page.getByRole('button', { name: '播放回放', exact: true }).click();
    await expect(page.getByRole('button', { name: '暂停回放', exact: true })).toBeVisible();
    await expect(progress).not.toHaveValue("0");
    await page.getByRole('button', { name: '返回实时赛局' }).click();
    await expect(dialog).toHaveCount(0);
  }
  await closeOverlay(page);
  await stepTraining(page);
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
