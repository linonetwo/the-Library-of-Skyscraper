import { z } from "zod";
const moduleIds = ["retreat", "haul", "build", "defend", "gather"];
const roles = { gatherer: "采撷师", guard: "守卷人", scout: "巡书使" };
const fields = {
  priority: "优先级",
  hpThreshold: "生命值阈值",
  minCargo: "最低携带藏材",
  minMaterials: "最低建材",
  targetRoomId: "采集目标房间",
  roomId: "房间",
  buildingKind: "设施",
};
export const behaviorActionSchemas = [
  ...["openBehavior", "undoBehaviorReplacement"].map((type) =>
    z.object({ type: z.literal(type) }).strict(),
  ),
  z
    .object({
      type: z.literal("loadBehaviorTemplate"),
      template: z.enum(["first-expedition", "logistics"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("openBehaviorSource"),
      moduleId: z.enum(moduleIds),
    })
    .strict(),
  z
    .object({
      type: z.literal("setBehaviorModule"),
      moduleId: z.enum(moduleIds),
      enabled: z.boolean().optional(),
      priority: z.number().int().optional(),
      roles: z.array(z.enum(Object.keys(roles))).optional(),
      config: z
        .object({
          hpThreshold: z.number().min(0).max(100).optional(),
          minCargo: z.number().min(0).optional(),
          minMaterials: z.number().min(0).optional(),
          targetRoomId: z.string().optional(),
          roomId: z.string().optional(),
          buildingKind: z.enum(["catalog", "tower"]).optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
];
async function open(page) {
  const tab = page.getByRole("tab", { name: "行为模块", exact: true });
  if (!(await tab.isVisible()))
    await page.getByRole("button", { name: "AI 模块", exact: true }).click();
  await tab.click();
  await page.locator(".behavior-workbench").waitFor();
}
async function expand(page, id) {
  const card = page.locator(`#module-${id}`);
  await card.waitFor();
  const toggle = card.locator("button[aria-expanded]");
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
    await toggle.click();
  return card;
}
export async function performBehaviorAction(page, action) {
  if (
    ![
      "openBehavior",
      "loadBehaviorTemplate",
      "setBehaviorModule",
      "undoBehaviorReplacement",
      "openBehaviorSource",
    ].includes(action.type)
  )
    return false;
  await open(page);
  if (action.type === "openBehavior") return true;
  if (action.type === "loadBehaviorTemplate") {
    await page
      .getByRole("combobox", { name: "载入官方行为组合" })
      .selectOption(
        action.template === "first-expedition" ? "expedition" : "logistics",
      );
  } else if (action.type === "undoBehaviorReplacement") {
    await page
      .getByRole("button", { name: "撤销上次替换", exact: true })
      .click();
  } else {
    const card = await expand(page, action.moduleId);
    if (action.type === "openBehaviorSource")
      await card
        .getByRole("button", { name: "查看源码 ↗", exact: true })
        .click();
    else {
      if (action.enabled !== undefined)
        await card
          .locator("header input[type=checkbox]")
          .setChecked(action.enabled);
      if (action.priority !== undefined)
        await card.getByLabel(/优先级$/).fill(String(action.priority));
      if (action.roles) {
        // Add the requested roles before removing others; unchecked means all roles in the UI.
        for (const checked of [true, false])
          for (const [role, name] of Object.entries(roles))
            if (action.roles.includes(role) === checked)
              await card
                .getByRole("checkbox", { name, exact: true })
                .setChecked(checked);
      }
      for (const [key, value] of Object.entries(action.config ?? {})) {
        const label =
          key === "roomId"
            ? action.moduleId === "build"
              ? "建造房间"
              : "防守房间"
            : fields[key];
        const control = card.getByLabel(label, { exact: true });
        if (["roomId", "targetRoomId", "buildingKind"].includes(key))
          await control.selectOption(value);
        else await control.fill(String(value));
      }
    }
  }
  return true;
}
export async function readBehaviorState(page) {
  const workbench = page.locator(".behavior-workbench");
  if (
    !(await workbench.count()) &&
    !(await page.locator(".behavior-trace").count())
  )
    return null;
  return {
    modules: await workbench.locator(".behavior-card").evaluateAll((cards) =>
      cards.map((card) => ({
        moduleId: card.id.slice("module-".length),
        enabled: card.querySelector("header input").checked,
        expanded:
          card
            .querySelector("[aria-expanded]")
            .getAttribute("aria-expanded") === "true",
        summary: card
          .querySelector(".behavior-card-summary")
          .textContent.trim(),
        controls: [...card.querySelectorAll("input,select")].map((control) => ({
          label:
            control.getAttribute("aria-label") ??
            control.closest("label")?.textContent.trim(),
          value: control.type === "checkbox" ? control.checked : control.value,
        })),
      })),
    ),
    path: await workbench
      .getByRole("navigation", { name: "优先级组合路径" })
      .allTextContents(),
    traces: await page
      .locator(".behavior-trace")
      .evaluateAll((traces) =>
        traces.map((trace) => ({
          source: trace.getAttribute("aria-label"),
          heading: trace.querySelector("h4").textContent.trim(),
          sourceHash: trace.querySelector("h4").getAttribute("title"),
          sourceHashPrefix: trace
            .querySelector("h4")
            .textContent.trim()
            .split(" · ")
            .at(-1),
          text: trace.innerText,
        })),
      ),
    publishedVersion: (await workbench.count())
      ? await workbench.locator(".script-version").innerText()
      : null,
    canUndoReplacement:
      (await workbench
        .getByRole("button", { name: "撤销上次替换", exact: true })
        .count()) > 0,
  };
}
