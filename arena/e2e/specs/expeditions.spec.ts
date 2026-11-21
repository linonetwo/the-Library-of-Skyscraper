import { openMenu, closeOverlay, stepTraining } from './hud-helpers';
import { test, expect } from "@playwright/test";

test("a closed tab can resume its saved squad and wardrobe", async ({ context, page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await openMenu(page, '训练控制');
  await page.getByRole("button", { name: "重置训练局" }).click();
  await page.getByRole('button', {name:'角色详情',exact:true}).click();
  await page.getByRole("button", { name: "书库守卫", exact: true }).click();
  await page.getByRole("button", { name: "墨蓝发色" }).click();
  await stepTraining(page);
  const identity = await page.evaluate(() => JSON.parse(sessionStorage.getItem("arena-session")!));
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  expect(await reopened.evaluate(() => sessionStorage.getItem("arena-session"))).toBeNull();
  await reopened.getByRole("button", { name: "继续上次远征" }).click();
  await reopened.getByRole("button",{name:"角色详情",exact:true}).click();
  await expect(reopened.locator(".portrait-frame .paper-doll")).toHaveClass(/warden/);
  await expect(reopened.getByRole("button", { name: "墨蓝发色" })).toHaveClass(/selected/);
  await openMenu(reopened, '训练控制');
  await expect(reopened.getByRole("button", { name: "继续", exact: true })).toBeVisible();
  expect(await reopened.evaluate(() => JSON.parse(sessionStorage.getItem("arena-session")!))).toEqual(identity);
});
