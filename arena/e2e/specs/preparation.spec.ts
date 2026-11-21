import { test, expect } from "@playwright/test";
import { openMenu, stepTraining } from "./hud-helpers";
test("new squad focuses at one scale and recommended tasks collapse without starting", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征", exact: true }).click();
  const map = page.locator(".pixi-map");
  const camera = () =>
    map.getAttribute("data-camera").then((v) => JSON.parse(v || "{}"));
  await expect.poll(async () => (await camera()).scale).toBe(1);
  await page.getByRole("button", { name: "推荐分工", exact: true }).click();
  await expect(page.locator(".task-picker")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "开始远征", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "选择守卷人", exact: true }).click();
  await page.getByRole("button", { name: "安排任务", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "护卫编目", exact: true }),
  ).toHaveClass("selected");
  await page.getByRole("button", { name: "收起任务", exact: true }).click();
  await page.getByRole("button", { name: "全图总览", exact: true }).click();
  const overview = await camera();
  expect(overview.scale).toBeLessThan(1);
  await stepTraining(page);
  expect((await camera()).scale).toBeCloseTo(overview.scale);
  await page.getByRole("button", { name: "重置训练局", exact: true }).click();
  await expect.poll(async () => (await camera()).scale).toBe(1);
});
