import { z } from "zod";
const id = z.string().min(1).max(160);
const kind = z.enum(["nodes", "states", "transitions", "roles", "modules"]);
const simple = [
  "openRuleGraph",
  "convertBehaviorToRuleGraph",
  "copyRuleGraphSelection",
  "deleteRuleGraphSelection",
  "undoRuleGraph",
  "redoRuleGraph",
  "locateRuleGraphSource",
];
export const graphActionSchemas = [
  z
    .object({
      type: z.literal("setRuleGraphView"),
      view: z.enum(["states", "tree"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("selectRuleGraphTree"),
      stateId: z.string().max(160),
    })
    .strict(),
  ...simple.map((type) => z.object({ type: z.literal(type) }).strict()),
  z
    .object({
      type: z.literal("loadRuleGraphTemplate"),
      template: z.enum(["logistics", "retreat"]),
    })
    .strict(),
  z.object({ type: z.literal("selectRuleGraphObject"), kind, id }).strict(),
  z
    .object({
      type: z.literal("addRuleGraphObject"),
      kind: z.enum([
        "state",
        "transition",
        "role",
        "condition",
        "check",
        "priority",
        "sequence",
        "score",
        "log",
        "module",
        "hold",
        "pass",
      ]),
    })
    .strict(),
  z.object({ type: z.literal("renameRuleGraphObject"), id }).strict(),
  z
    .object({
      type: z.literal("setRuleGraphField"),
      label: z.string().min(1).max(100),
      value: z.union([z.string().max(4000), z.number().finite(), z.boolean()]),
      index: z.number().int().min(0).max(100).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("connectRuleGraph"),
      port: z.string().min(1).max(100),
      target: z.string().max(160),
      index: z.number().int().min(0).max(100).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("selectRuleGraphDiagnostic"),
      index: z.number().int().min(0),
    })
    .strict(),
];
async function open(page) {
  const tab = page.getByRole("tab", { name: "规则图", exact: true });
  if (!(await tab.isVisible()))
    await page.getByRole("button", { name: "AI 模块", exact: true }).click();
  await tab.click();
}
export async function performGraphAction(page, action) {
  if (
    !graphActionSchemas.some(
      (schema) => schema.shape.type.value === action.type,
    )
  )
    return false;
  if (action.type === "openRuleGraph") {
    await open(page);
    return true;
  }
  const click = (name) =>
    page.getByRole("button", { name, exact: true }).click();
  if (action.type === "loadRuleGraphTemplate")
    await click(
      action.template === "logistics" ? "载入物流状态图" : "载入撤退冷却图",
    );
  else if (action.type === "convertBehaviorToRuleGraph")
    await click("从当前五卡显式创建规则图");
  else {
    const graph = page.getByRole("region", {
      name: "规则图编辑器",
      exact: true,
    });
    await graph.waitFor({ state: "visible" });
    if (action.type === "setRuleGraphView") {
      await graph
        .getByRole("tab", {
          name: action.view === "tree" ? "决策树" : "状态图",
          exact: true,
        })
        .click();
    } else if (action.type === "selectRuleGraphTree") {
      await graph.getByRole("tab", { name: "决策树", exact: true }).click();
      await graph
        .getByLabel("查看状态持续树", { exact: true })
        .selectOption(action.stateId);
    } else if (action.type === "selectRuleGraphObject") {
      // Resolve user IDs as data, never interpolate them into CSS selectors.
      const buttons = graph.locator("[data-object-kind][data-object-id]");
      const values = await buttons.evaluateAll((items) =>
        items.map((item) => ({
          kind: item.dataset.objectKind,
          id: item.dataset.objectId,
        })),
      );
      const index = values.findIndex(
        (item) => item.kind === action.kind && item.id === action.id,
      );
      if (index < 0)
        throw new Error("Visible graph object does not exist: " + action.id);
      await buttons.nth(index).click();
    } else if (action.type === "addRuleGraphObject") {
      await graph
        .getByLabel("新增规则对象类型", { exact: true })
        .selectOption(action.kind);
      await click("新增规则对象");
    } else if (action.type === "renameRuleGraphObject") {
      await graph.getByLabel("对象新ID", { exact: true }).fill(action.id);
      await click("更名并重连引用");
    } else if (
      action.type === "setRuleGraphField" ||
      action.type === "connectRuleGraph"
    ) {
      const inspector = graph.getByRole("region", {
        name: "选中规则对象参数",
        exact: true,
      });
      const field = inspector
        .getByLabel(
          action.type === "connectRuleGraph" ? action.port : action.label,
          { exact: true },
        )
        .nth(action.index ?? 0);
      const tag = await field.evaluate((element) => element.tagName);
      const value =
        action.type === "connectRuleGraph" ? action.target : action.value;
      if (tag === "SELECT") await field.selectOption(String(value));
      else if (typeof value === "boolean") await field.setChecked(value);
      else await field.fill(String(value));
    } else if (action.type === "selectRuleGraphDiagnostic")
      await graph
        .getByRole("region", { name: "规则图诊断", exact: true })
        .getByRole("button")
        .nth(action.index)
        .click();
    else
      await click(
        {
          copyRuleGraphSelection: "复制所选片段",
          deleteRuleGraphSelection: "删除所选对象",
          undoRuleGraph: "撤销图修改",
          redoRuleGraph: "重做图修改",
          locateRuleGraphSource: "定位源码 ↗",
        }[action.type],
      );
  }
  if (action.type === "locateRuleGraphSource") {
    await page
      .getByRole("textbox", { name: "TypeScript规则源码", exact: true })
      .waitFor({ state: "visible", timeout: 20000 });
    await page.waitForFunction(() => {
      const button = document.querySelector(".graph-source-locate button");
      return button && !button.disabled;
    });
  }
  return true;
}
export async function readGraphState(page) {
  const editor = page.locator("[data-rule-graph]");
  const visible = await editor.isVisible();
  const state = visible
    ? JSON.parse(await editor.getAttribute("data-graph-state"))
    : {};
  const source = page.locator(".graph-source-locate");
  return {
    visible,
    ...state,
    nodes: visible
      ? await editor.locator("[data-node-id]").evaluateAll((items) =>
          items.map((item) => ({
            id: item.dataset.nodeId,
            text: item.textContent,
          })),
        )
      : [],
    edges: visible
      ? await editor.locator("[data-edge-id]").evaluateAll((items) =>
          items.map((item) => ({
            id: item.dataset.edgeId,
            from: item.dataset.from,
            to: item.dataset.to,
            port: item.dataset.port,
          })),
        )
      : [],
    source: (await source.isVisible()) ? await source.innerText() : null,
    results: await page
      .getByRole("region", { name: "脚本运行结果", exact: true })
      .allTextContents(),
    traces: await page
      .locator(
        '.behavior-trace, .recorded-graph-trace, section[aria-label="当前草稿规则图试跑路径"]',
      )
      .evaluateAll((items) =>
        items
          .filter((item) => item.getClientRects().length)
          .map((item) => ({
            source: item.getAttribute("aria-label"),
            sourceHash:
              item.getAttribute("data-source-hash") ??
              item.querySelector("h4")?.getAttribute("title") ??
              item.querySelector("code")?.textContent ??
              null,
            objects: [...item.querySelectorAll("button")].map(
              (button) => button.textContent,
            ),
            text: item.innerText,
          })),
      ),
  };
}
