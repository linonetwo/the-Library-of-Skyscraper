import type { Page } from "@playwright/test";
export async function openMenu(page: Page, destination: string) {
  const menu = page.getByRole("button", { name: "菜单", exact: true });
  if (destination === "联机大厅") {
    const entry = page.getByRole("button", { name: /或加入联机赛局/ });
    await menu.or(entry).first().waitFor({ state: "visible" });
    if (!(await menu.isVisible())) {
      await entry.click();
      return;
    }
  } else {
    await menu.waitFor({ state: "visible" });
  }
  const target = page.getByRole("button", { name: destination, exact: true });
  if (!(await target.isVisible())) await menu.click();
  await target.click();
}
export async function closeOverlay(page: Page) {
  await page.getByRole("button", { name: "关闭面板", exact: true }).click();
}
export async function stepTraining(page: Page) {
  if (
    !(await page.getByRole("button", { name: "单步", exact: true }).isVisible())
  )
    await openMenu(page, "训练控制");
  await page.getByRole("button", { name: "单步", exact: true }).click();
}
