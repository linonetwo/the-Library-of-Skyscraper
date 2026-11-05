import { test, expect } from '@playwright/test';

test('live and replay canvases keep independent rendering lifetimes', async ({ page }, testInfo) => {
  test.setTimeout(60000); // Three replay canvases and screenshots also run under CI software rendering.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '开启训练远征' }).click();
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  for (let step = 0; step < 8; step++) {
    await page.getByRole('button', { name: '单步', exact: true }).click();
  }
  await page.getByRole('button', { name: '赛局日志', exact: true }).click();
  for (let opening = 0; opening < 3; opening++) {
    await page.getByRole('button', { name: '播放赛局回放' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('canvas')).toBeVisible();
    const progress = page.getByRole('slider', { name: '回放进度' });
    await progress.fill(await progress.getAttribute('max') as string);
    await page.getByRole('button', { name: '播放回放', exact: true }).click();
    await expect(page.getByRole('button', { name: '暂停回放', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`replay-${opening}.png`) });
    await page.getByRole('button', { name: '返回实时赛局' }).click();
    await expect(dialog).toHaveCount(0);
  }
  await page.getByRole('button', { name: '战场总览', exact: true }).click();
  await page.getByRole('button', { name: '单步', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
