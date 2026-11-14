import { test, expect } from "@playwright/test";

test("eight directions play real distinct frames and allow deterministic inspection", async ({ page }) => {
  await page.goto("/animation-lab");
  await expect(page.getByRole("img")).toHaveCount(8);
  await page.getByRole("button", { name: "暂停动画" }).click();
  const initial = await page.getByLabel("当前帧").innerText();
  const background = await page.getByRole("img").first().getAttribute("style");
  await page.getByRole("button", { name: "下一帧" }).click();
  await expect(page.getByLabel("当前帧")).not.toHaveText(initial);
  expect(await page.getByRole("img").first().getAttribute("style")).not.toBe(background);
  await expect(page.getByRole("note")).toContainText("不包含动画衣装");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
