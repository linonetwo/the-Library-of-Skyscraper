import type { Page } from '@playwright/test';
export async function openMenu(page: Page, destination: string) {
  if(destination==='联机大厅'&&!await page.getByRole('button',{name:'菜单',exact:true}).isVisible()){await page.getByRole('button',{name:/或加入联机赛局/}).click();return;}
  await page.getByRole('button', { name: '菜单', exact: true }).click();
  await page.getByRole('button', { name: destination, exact: true }).click();
}
export async function closeOverlay(page: Page) {
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
}
export async function stepTraining(page: Page) {
  if (!await page.getByRole('button',{name:'单步',exact:true}).isVisible()) await openMenu(page,'训练控制');
  await page.getByRole('button',{name:'单步',exact:true}).click();
}
