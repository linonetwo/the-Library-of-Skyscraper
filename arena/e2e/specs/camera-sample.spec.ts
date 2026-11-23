import { test, expect } from "@playwright/test";
test("registered 16-phase sample switches independent layers and freezes route phase", async ({
  page,
}) => {
  const atlasRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("-study/") && r.url().endsWith(".json"))
      atlasRequests.push(r.url());
  });
  await page.goto("/camera-sample");
  const pose = () =>
    page
      .locator(".pixi-map")
      .getAttribute("data-actors")
      .then((v) => JSON.parse(v || "[]")[0]);
  await expect
    .poll(async () => (await pose())?.textures)
    .toEqual([
      "walk/body/SW/00",
      "walk/body-front/SW/00",
      "walk/hand-front/SW/00",
    ]);
  expect(atlasRequests.some((url) => url.includes("hair-"))).toBe(false);
  await page.getByLabel("样板衣装").selectOption("warden");
  await page.getByLabel("样板发型").selectOption("midnight");
  await page.getByLabel("法杖（握持手互斥）").check();
  await expect
    .poll(async () => (await pose())?.textures)
    .toEqual([
      "walk/weapon-staff-back/SW/00",
      "walk/hair-midnight-back/SW/00",
      "walk/body/SW/00",
      "walk/outfit-warden/SW/00",
      "walk/weapon-staff-front/SW/00",
      "walk/body-front/SW/00",
      "walk/outfit-warden-front/SW/00",
      "walk/hand-grip/SW/00",
      "walk/hair-midnight-front/SW/00",
    ]);
  await page.getByLabel("样板发型").selectOption("none");
  await expect
    .poll(async () =>
      (await pose())?.textures?.some((t: string) => t.includes("hair")),
    )
    .toBe(false);
  await page
    .getByRole("button", { name: "沿12格道移动1.5格/秒", exact: true })
    .click();
  await expect
    .poll(async () => (await pose())?.worldPosition.y)
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const paused = await pose();
  await page.waitForTimeout(150);
  const still = await pose();
  expect(still.worldPosition).toEqual(paused.worldPosition);
  expect(still.textures).toEqual(paused.textures);
});

test("semantic candidates use their own banks and deterministic cue seeks", async ({
  page,
}) => {
  await page.goto("/camera-sample");
  const pose = () =>
    page
      .locator(".pixi-map")
      .getAttribute("data-actors")
      .then((v) => JSON.parse(v || "[]")[0]);
  await page.getByLabel("样板动作").selectOption("attack");
  await expect
    .poll(async () =>
      (await pose())?.textures?.every((key: string) =>
        key.startsWith("attack/"),
      ),
    )
    .toBe(true);
  const time = page.getByLabel("样板模拟时间");
  await time.focus();
  await time.press("End");
  await expect.poll(async () => (await pose())?.animation).toBe("idle");
  await time.press("ArrowLeft");
  await expect.poll(async () => (await pose())?.frame).toBe(3);
  const last = await pose();
  expect(last.animation).toBe("attack");
  await time.press("Home");
  await expect.poll(async () => (await pose())?.frame).toBe(0);
  await time.press("End");
  await time.press("ArrowLeft");
  await expect
    .poll(async () => (await pose())?.textures)
    .toEqual(last.textures);
  await page.getByLabel("样板动作").selectOption("hit");
  await expect
    .poll(async () =>
      (await pose())?.textures?.every((key: string) => key.startsWith("hit/")),
    )
    .toBe(true);
  await time.focus();
  await time.press("End");
  await time.press("ArrowLeft");
  await expect.poll(async () => (await pose())?.frame).toBe(1);
  await page.getByLabel("样板动作").selectOption("idle");
  await expect
    .poll(async () =>
      (await pose())?.textures?.every((key: string) => key.startsWith("idle/")),
    )
    .toBe(true);
});
