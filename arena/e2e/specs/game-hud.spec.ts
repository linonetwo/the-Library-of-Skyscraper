import {test,expect} from '@playwright/test';
test('fullscreen HUD keeps actions and optional panels accessible',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开启训练远征',exact:true}).click();
 await expect(page.getByRole('region',{name:'选中角色操作'})).toBeVisible();
 await expect(page.locator('.pixi-map').first()).toHaveAttribute('aria-busy','false',{timeout:15000});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:844});
  const map=await page.locator('.pixi-map').boundingBox();expect(map?.width).toBe(width);expect(map?.height).toBe(844);
  await page.getByRole('button',{name:'角色详情'}).click();
  const portrait=page.locator('.character-drawer img[alt="同相机角色预览"]');
  await expect(portrait).toBeVisible();
  await expect.poll(()=>portrait.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'角色详情'})).toBeFocused();
  await expect(page.locator('.character-drawer')).toHaveCount(0);
  await page.getByRole('button',{name:'菜单',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'游戏菜单'})).toBeVisible();
  await page.getByRole('button',{name:'菜单',exact:true}).click();
  await expect(page.getByRole('button',{name:'采集运输',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'AI 模块',exact:true}).click();
  await expect(page.getByRole('tab',{name:'TypeScript',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('textbox',{name:'TypeScript规则源码'})).toBeVisible();
  await page.getByRole('tab',{name:'行动预设',exact:true}).click();
  await expect(page.getByRole('button',{name:'确认并发布规则',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.workspace-overlay')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'菜单',exact:true})).toBeFocused();
 }
});
