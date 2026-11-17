import { test, expect } from "@playwright/test";

test("eight directions play real distinct frames and allow deterministic inspection", async ({ page }) => {
  await page.goto("/animation-lab");
  await page.getByLabel("动作", { exact: true }).selectOption("walk");
  await expect(page.getByRole("region", { name: "八方向动画预览" }).getByRole("img")).toHaveCount(8);
  await page.getByRole("button", { name: "暂停动画" }).click();
  const initial = await page.getByLabel("当前帧").innerText();
  const background = await page.getByRole("region", { name: "八方向动画预览" }).getByRole("img").first().getAttribute("style");
  await page.getByRole("button", { name: "下一帧" }).click();
  await expect(page.getByLabel("当前帧")).not.toHaveText(initial);
  expect(await page.getByRole("region", { name: "八方向动画预览" }).getByRole("img").first().getAttribute("style")).not.toBe(background);
  await page.getByText("图层与素材信息", {exact:true}).click();
  await expect(page.getByRole("note")).toContainText("32 帧独立图集");
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-outfit")).toHaveCount(8);
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-hair")).toHaveCount(16);
  await page.getByLabel("月白发型动画层").uncheck();
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-hair")).toHaveCount(0);
  await page.getByLabel("月白发型动画层").check();
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-hair")).toHaveCount(16);
  await page.getByLabel("学者服动画层").uncheck();
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-outfit")).toHaveCount(0);
  await page.getByLabel("学者服动画层").check();
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-outfit")).toHaveCount(8);
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-weapon")).toHaveCount(16);
  await page.getByLabel("法杖动画层").uncheck();
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-weapon")).toHaveCount(0);
  await page.getByLabel("法杖动画层").check();
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-weapon")).toHaveCount(16);
  await page.getByLabel("动画衣装").selectOption("warden");
  await expect(page.getByRole("region", { name: "八方向动画预览" }).locator(".animated-outfit").first()).toHaveAttribute("style", /warden/);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("workshop supports narrow screens and direction selection", async ({ page }) => {
 await page.goto('/animation-lab');
 await page.getByRole('button',{name:'暂停动画'}).click();
 await page.getByRole('button',{name:'背面 N',exact:true}).click();
 await expect(page.getByRole('region',{name:'角色重点预览'}).getByRole('img')).toHaveAttribute('aria-label',/N方向/);
 await page.getByLabel('动画衣装').selectOption('warden');
 await page.getByLabel('动画发型').selectOption('midnight');
 for(const width of [1440,800,390,360]) {
  await page.setViewportSize({width,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByLabel('动画衣装')).toBeVisible();
 }
});
