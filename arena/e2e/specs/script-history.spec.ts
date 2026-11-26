import { openMenu, closeOverlay } from './hud-helpers';
import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";

async function capture(page: Page, label: string) {
  if (!process.env.ARENA_CAPTURE_DAY) return;
  const name = `竞技场${process.env.ARENA_CAPTURE_DAY}${label}实机.png`;
  const destination = path.resolve("../../wiki/tiddlers", name);
  await page.locator(".script-history").scrollIntoViewIfNeeded();
  if (label === "规则源码差异") {
    await page.getByRole("region", { name: "规则源码差异" }).scrollIntoViewIfNeeded();
  }
  await page.screenshot({ path: destination, fullPage: true });
  await writeFile(`${destination}.meta`, `title: ${name}\ntype: image/png\n`);
}

async function openScripts(page: Page) {
  await openMenu(page, 'AI 模块编辑');
  await page.getByRole("tab", { name: "TypeScript", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "TypeScript规则源码" })).toBeVisible({ timeout: 20000 });
}
async function draft(page: Page) {
  return page.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem("arena-session")!);
    return JSON.parse(localStorage.getItem(`arena-rule-project:${session.sessionId}:${session.playerId}`)!);
  });
}
async function paste(page: Page, source: string) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(text => navigator.clipboard.writeText(text), source);
  await page.getByRole("textbox", { name: "TypeScript规则源码" }).focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+v");
  await expect.poll(async () => { const project = await draft(page); return project.files[project.activeFile]; }).toBe(source);
}

test("history loads a multi-file draft, shows differences and restores the battle version independently", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.stack ?? error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("arena-session"))).not.toBeNull();
  const seeded = await page.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem("arena-session")!);
    const post = (suffix: string, body: object) => fetch(`/api/sessions/${session.sessionId}/${suffix}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(response => response.json());
    const files = {
      "main.ts": `import type { RuleContext } from '@skyscraper/arena-script-sdk';
import { destination } from './helpers';
export function decide(ctx: RuleContext) {
  return { intents: ctx.squad.actors.map(actor => ({
    type: 'move' as const, actorId: actor.id, roomId: destination(actor.roomId), priority: 50
  })) };
}`,
      "helpers.ts": `export const destination = (room: string) => room === 'room-0' ? 'room-1' : 'room-0';`,
    };
    const a = await post("scripts/publish", { files, entry: "main.ts" });
    await post("commands", { type: "step", ticks: 1 });
    await post("scripts/publish", { files: { "main.ts": "export function decide() { return { intents: [] }; }" } });
    return { hash: a.compilation.bundle.sourceHash, files };
  });
  await openScripts(page);
  await page.locator(".script-history summary").click();
  const history = page.getByLabel("规则历史版本");
  await expect(history.locator("option")).toHaveCount(3);
  await history.selectOption(seeded.hash);
  await page.getByRole("button", { name: "载入为草稿", exact: true }).click();
  await expect(page.getByRole("tab", { name: "helpers.ts", exact: true })).toBeVisible();
  expect((await draft(page)).files).toEqual(seeded.files);
  await capture(page, "规则历史载入");
  await page.getByRole("tab", { name: "helpers.ts", exact: true }).click();
  await paste(page, `${seeded.files["helpers.ts"]}\n// Local draft stays independent of restored battle rules.`);
  const beforeRestore = await draft(page);
  await page.getByLabel("查看与草稿差异").check();
  await page.getByLabel("对比源码文件").selectOption("helpers.ts");
  await expect(page.getByRole("region", { name: "规则源码差异" })).toBeVisible();
  await expect(page.getByRole("region", { name: "规则源码差异" })).toContainText("Local draft stays independent");
  await capture(page, "规则源码差异");
  const restored = page.waitForResponse(response => response.url().endsWith("/scripts/rollback"));
  await page.getByRole("button", { name: "恢复此版本", exact: true }).click();
  expect((await (await restored).json()).players[0].script.sourceHash).toBe(seeded.hash);
  await expect(page.getByLabel("当前规则版本")).toContainText(seeded.hash.slice(0, 12));
  expect(await draft(page)).toEqual(beforeRestore);
  await capture(page, "规则版本恢复");
  const moved = await page.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem("arena-session")!);
    return fetch(`/api/sessions/${session.sessionId}/commands`, {
      method: "POST", headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "step", ticks: 1 }),
    }).then(response => response.json());
  });
  expect(moved.actors.every((actor: { roomId: string }) => actor.roomId === "room-0")).toBe(true);
  await page.reload();
  await openScripts(page);
  await expect(page.getByRole("tab", { name: "helpers.ts", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await draft(page)).toEqual(beforeRestore);
  expect(errors).toEqual([]);
});

test("a diagnostic opens its source file in the multi-file editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await openScripts(page);
  await page.getByLabel("新规则文件名").fill("helpers.ts");
  await page.getByRole("button", { name: "添加文件", exact: true }).click();
  await paste(page, 'export const amount: number = "invalid";');
  await page.getByRole("tab", { name: "main.ts · 入口", exact: true }).click();
  await page.getByRole("button", { name: "编译 TypeScript", exact: true }).click();
  const diagnostic = page.locator(".script-diagnostic").filter({ hasText: "helpers.ts:1:" });
  await expect(diagnostic).toBeVisible({ timeout: 20000 });
  await diagnostic.click();
  await expect(page.getByRole("tab", { name: "helpers.ts", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("textbox", { name: "TypeScript规则源码" })).toBeFocused();
  expect((await draft(page)).activeFile).toBe("helpers.ts");
});

test("a delayed publication cannot replace a newly opened session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启训练远征" }).click();
  await openScripts(page);
  const previous = await page.evaluate(() => JSON.parse(sessionStorage.getItem("arena-session")!).sessionId);
  let release!: () => void;
  let received!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const intercepted = new Promise<void>(resolve => { received = resolve; });
  await page.route("**/scripts/publish", async route => {
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "发布到战场" }).click();
  await intercepted;
  await openMenu(page, '联机大厅');
  await page.getByRole("dialog", { name: "赛局入口" }).getByRole("button", { name: "本地训练", exact: false }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("arena-session")!).sessionId)).not.toBe(previous);
  const current = await page.evaluate(() => JSON.parse(sessionStorage.getItem("arena-session")!).sessionId);
  expect(current).not.toBe(previous);
  const completed = page.waitForResponse(response => response.url().endsWith("/scripts/publish"));
  release();
  await completed;
  await openScripts(page);
  await expect(page.getByLabel("当前规则版本")).toContainText("预设");
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("arena-session")!).sessionId)).toBe(current);
});
