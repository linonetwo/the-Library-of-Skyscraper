import { test, expect } from "@playwright/test";
const gallery = (page: import('@playwright/test').Page) => page.getByRole('region', { name: '八方向动画预览' });
const poses = async (page: import('@playwright/test').Page) => JSON.parse(await gallery(page).locator('[data-lab-poses]').getAttribute('data-lab-poses') || '[]');
const ready = async (page: import('@playwright/test').Page) => { await expect(gallery(page).locator('[data-lab-ready]')).toHaveAttribute('data-lab-ready', 'true'); };
test("same-source workshop plays all registered headings and inspects independent layers", async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/animation-lab'); await ready(page);
  await page.getByLabel('动作', { exact: true }).selectOption('walk'); await ready(page);
  await page.getByRole('button', { name: '暂停动画', exact: true }).click();
  expect((await poses(page)).length).toBe(8);
  const initial = (await poses(page))[0].frame;
  const image = await gallery(page).locator('canvas').screenshot();
  await page.getByRole('button', { name: '下一帧', exact: true }).click();
  await expect.poll(async () => (await poses(page))[0].frame).toBe((initial + 1) % 16);
  expect(await gallery(page).locator('canvas').screenshot()).not.toEqual(image);
  for (const [label, prefix] of [['月白发型动画层','hair-'], ['学者服动画层','outfit-'], ['法杖动画层','weapon-']]) {
    await page.getByLabel(label).uncheck(); await ready(page);
    expect((await poses(page)).every((pose: { layers: string[] }) => !pose.layers.some(layer => layer.includes(`/${prefix}`)))).toBe(true);
    await page.getByLabel(label).check(); await ready(page);
    expect((await poses(page)).every((pose: { layers: string[] }) => pose.layers.some(layer => layer.includes(`/${prefix}`)))).toBe(true);
  }
  await page.getByLabel('动画衣装').selectOption('warden');
  await page.getByLabel('动画发型').selectOption('midnight'); await ready(page);
  expect((await poses(page)).every((pose: { layers: string[] }) => pose.layers.some(layer => layer.includes('/outfit-warden/')) && pose.layers.some(layer => layer.includes('/hair-midnight-')))).toBe(true);
  expect(errors).toEqual([]);
});
test("pilot coverage remains explicit and each complete jump frame is reachable", async ({ page }) => {
  await page.goto('/animation-lab'); await ready(page);
  await page.getByLabel('动作', { exact: true }).selectOption('jump'); await ready(page);
  if (await page.getByRole('button', { name: '暂停动画', exact: true }).count()) await page.getByRole('button', { name: '暂停动画', exact: true }).click();
  expect((await poses(page)).map((pose: { direction: string }) => pose.direction).sort()).toEqual(['NE','SW']);
  await expect(page.getByRole('button', { name: '背面 N', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '左前 SW', exact: true }).click();
  await expect(gallery(page).getByRole('img')).toHaveAttribute('aria-label', /SW方向/);
  const frames = new Set<number>();
  for (let i = 0; i < 8; i++) { frames.add((await poses(page))[0].frame); await page.getByRole('button', { name: '下一帧', exact: true }).click(); }
  expect([...frames].sort()).toEqual([0,1,2,3,4,5,6,7]);
  for (const width of [1440,800,390,360]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByLabel('动画衣装')).toBeVisible();
  }
});
