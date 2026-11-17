import {test,expect} from '@playwright/test';
test('fullscreen HUD keeps actions and optional panels accessible',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开启训练远征',exact:true}).click();
 await expect(page.getByRole('region',{name:'选中角色操作'})).toBeVisible();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:844});
  const map=await page.locator('.pixi-map').boundingBox();expect(map?.width).toBe(width);expect(map?.height).toBe(844);
  await page.getByRole('button',{name:'详情 / 换装'}).click();
  await expect(page.locator('.character-drawer .animated-outfit')).toBeVisible();
  await page.getByRole('button',{name:'关闭角色面板'}).click();
  await expect(page.locator('.character-drawer')).toHaveCount(0);
  await page.getByRole('button',{name:'菜单',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'游戏菜单'})).toBeVisible();
  await page.getByRole('button',{name:'关闭菜单',exact:true}).click();
  await expect(page.getByRole('button',{name:'采集',exact:true})).toBeEnabled();
 }
});
