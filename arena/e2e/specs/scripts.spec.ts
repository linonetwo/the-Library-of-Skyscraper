import { test, expect } from "@playwright/test";

test("Monaco compiles and V8 previews a rule against a paused authoritative snapshot", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await page.getByRole("button", { name: "重置训练局" }).click();
  await page.getByRole("button", { name: "单步", exact: true }).click();
  await page.getByRole("button", { name: "行动规则", exact: true }).click();
  await page.getByRole("button", { name: "编写 TypeScript 规则 →" }).click();
  await expect(page.getByRole("textbox", { name: "TypeScript规则源码" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "试跑当前快照" }).click();
  await expect(page.getByRole("region", { name: "脚本运行结果" })).toContainText("动作意图 3 条", { timeout: 20000 });
  await expect(page.getByRole("region", { name: "脚本运行结果" })).toContainText("T1 · V8");
  await page.screenshot({ path: testInfo.outputPath("script-preview.png") });
  const input = page.getByRole("textbox", { name: "TypeScript规则源码" });
  await input.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("export function decide() { return { intents: 42 }; }");
  await page.getByRole("button", { name: "编译 TypeScript" }).click();
  await expect(page.locator(".script-diagnostic").first()).toBeVisible({ timeout: 20000 });
  const state = await page.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem("arena-session")!);
    return fetch(`/api/sessions/${session.sessionId}/state`, {
      headers: { Authorization: `Bearer ${session.token}` },
    }).then(response => response.json());
  });
  expect(state.tick).toBe(1);
  expect(errors).toEqual([]);
});
