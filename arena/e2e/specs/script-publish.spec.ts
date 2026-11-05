import { test, expect } from "@playwright/test";

test("publish TypeScript to training ticks, hold, then return to preset", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await page.getByRole("button", { name: "重置训练局" }).click();
  await page.getByRole("button", { name: "行动规则", exact: true }).click();
  await page.getByRole("button", { name: "编写 TypeScript 规则 →" }).click();
  const input = page.getByRole("textbox", { name: "TypeScript规则源码" });
  await expect(input).toBeVisible({ timeout: 20000 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  async function writeRule(source: string) {
    await page.evaluate(text => navigator.clipboard.writeText(text), source);
    await input.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+v");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("arena-rule-draft"))).toBe(source);
  }
  await writeRule(`import type { RuleContext } from '@skyscraper/arena-script-sdk';
export function decide(ctx: RuleContext) {
  return { intents: ctx.squad.actors.filter(actor => actor.roomId === 'room-0').map(actor => ({
    type: 'move' as const, actorId: actor.id, roomId: 'room-1', priority: 50
  })) };
}`);
  const published = page.waitForResponse(response => response.url().endsWith("/scripts/publish"));
  await page.getByRole("button", { name: "发布到战场" }).click();
  expect((await (await published).json()).compilation.diagnostics).toEqual([]);
  await expect(page.getByLabel("当前规则版本")).toContainText("main.ts");
  const initial = await page.getByLabel("当前规则版本").innerText();
  async function step(ticks: number) {
    return page.evaluate(async count => {
      const session = JSON.parse(sessionStorage.getItem("arena-session")!);
      return fetch(`/api/sessions/${session.sessionId}/commands`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "step", ticks: count }),
      }).then(response => response.json());
    }, ticks);
  }
  const moved = await step(1);
  expect(moved.actors.every((actor: { roomId: string }) => actor.roomId === "room-1")).toBe(true);
  await writeRule("export function decide() { return { intents: [] }; }");
  const held = page.waitForResponse(response => response.url().endsWith("/scripts/publish"));
  await page.getByRole("button", { name: "发布到战场" }).click();
  expect((await held).status()).toBe(200);
  await expect(page.getByLabel("当前规则版本")).not.toHaveText(initial);
  const waiting = await step(2);
  expect(waiting.actors.every((actor: { cargo: number }) => actor.cargo === 0)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("script-published.png") });
  const disabled = page.waitForResponse(response => response.url().endsWith("/scripts/disable"));
  await page.getByRole("button", { name: "恢复行动预设" }).click();
  expect((await disabled).status()).toBe(200);
  const resumed = await step(1);
  expect(resumed.actors.some((actor: { cargo: number }) => actor.cargo > 0)).toBe(true);
  expect(resumed.players[0].script).toBeUndefined();
});

test("official resource template publishes a gathering strategy", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await page.getByRole("button", { name: "重置训练局" }).click();
  await page.getByRole("button", { name: "行动规则", exact: true }).click();
  await page.getByRole("button", { name: "编写 TypeScript 规则 →" }).click();
  await expect(page.getByRole("textbox", { name: "TypeScript规则源码" })).toBeVisible({ timeout: 20000 });
  await page.getByLabel("载入规则模板").selectOption("gather");
  const published = page.waitForResponse(response => response.url().endsWith("/scripts/publish"));
  await page.getByRole("button", { name: "发布到战场" }).click();
  const result = await (await published).json();
  expect(result.compilation.diagnostics).toEqual([]);
  await expect(page.getByLabel("当前规则版本")).toContainText("TS 规则已接管小队");
  const snapshot = await page.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem("arena-session")!);
    return fetch(`/api/sessions/${session.sessionId}/commands`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "step", ticks: 2 }),
    }).then(response => response.json());
  });
  const gatherer = snapshot.actors.find((actor: { role: string }) => actor.role === "gatherer");
  expect(gatherer.roomId).toBe("room-1");
  expect(gatherer.cargo).toBeGreaterThan(0);
});
