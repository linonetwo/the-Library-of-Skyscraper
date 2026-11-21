import { test, expect } from "@playwright/test";
test("camera study uses registered atlas layers and freezes its world clock", async ({
  page,
}) => {
  await page.goto("/camera-sample");
  await expect(page.locator("canvas")).toBeVisible();
  const pose = () =>
    page
      .locator(".pixi-map")
      .getAttribute("data-actors")
      .then((v) => JSON.parse(v || "[]")[0]);
  await expect
    .poll(async () => (await pose())?.textures)
    .toEqual(["walk/body/SW/00", "walk/body-front/SW/00"]);
  await page.getByLabel("学者衣装").check();
  await page.getByLabel("象牙白短发（关闭为裸头）").check();
  await page.getByLabel("两向步态候选").check();
  await expect
    .poll(async () => (await pose())?.textures)
    .toEqual([
      "walk/hair-ivory-back/SW/00",
      "walk/body/SW/00",
      "walk/outfit-scholar/SW/00",
      "walk/body-front/SW/00",
      "walk/hair-ivory-front/SW/00",
    ]);
  await page.getByLabel("象牙白短发（关闭为裸头）").uncheck();
  await expect
    .poll(async () => (await pose())?.textures)
    .toEqual([
      "walk/body/SW/00",
      "walk/outfit-scholar/SW/00",
      "walk/body-front/SW/00",
    ]);
  await page.getByLabel("象牙白短发（关闭为裸头）").check();
  await page
    .getByRole("button", { name: "沿8格道移动1.5格/秒", exact: true })
    .click();
  await expect
    .poll(async () => (await pose())?.worldPosition.y)
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const paused = await pose();
  await page.waitForTimeout(300);
  const still = await pose();
  expect(still.worldPosition).toEqual(paused.worldPosition);
  expect(still.textures).toEqual(paused.textures);
});
