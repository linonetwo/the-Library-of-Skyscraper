import { test, expect } from "@playwright/test";

test("a closed tab can resume its saved squad and wardrobe", async ({ context, page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await page.getByRole("button", { name: "重置训练局" }).click();
  await page.getByRole("button", { name: "书库守卫", exact: true }).click();
  await page.getByRole("button", { name: "墨蓝发色" }).click();
  await page.getByRole("button", { name: "单步", exact: true }).click();
  const identity = await page.evaluate(() => JSON.parse(sessionStorage.getItem("arena-session")!));
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  expect(await reopened.evaluate(() => sessionStorage.getItem("arena-session"))).toBeNull();
  await reopened.getByRole("button", { name: "继续上次远征" }).click();
  await expect(reopened.locator(".portrait-frame .paper-doll")).toHaveClass(/warden/);
  await expect(reopened.getByRole("button", { name: "墨蓝发色" })).toHaveClass(/selected/);
  await expect(reopened.getByRole("button", { name: "继续", exact: true })).toBeVisible();
  expect(await reopened.evaluate(() => JSON.parse(sessionStorage.getItem("arena-session")!))).toEqual(identity);
  await reopened.getByRole("button", { name: "联机大厅", exact: true }).click();
  await expect(reopened.getByRole("region", { name: "最近远征" })).toContainText("T1");
  await reopened.getByRole("dialog", { name: "赛局入口" })
    .getByRole("button", { name: "本地训练", exact: false }).click();
  await reopened.getByRole("button", { name: "联机大厅", exact: true }).click();
  await expect(reopened.locator(".expedition-card")).toHaveCount(2);
  await reopened.getByRole("button", { name: `继续远征 ${identity.sessionId}`, exact: true }).click();
  await expect(reopened.locator(".portrait-frame .paper-doll")).toHaveClass(/warden/);
});
