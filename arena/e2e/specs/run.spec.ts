import { test, expect } from '@playwright/test';
import { animationLayers } from '../../client/src/walkLayers';

test('run has six authored frames for every direction and appearance', async ({ page, request }) => {
 const names=new Set<string>();
 for(const outfit of ['scholar','warden'] as const)
  for(const hair of ['ivory','midnight'] as const)
   for(const weapon of [true,false])
    animationLayers('run',{outfit,hair,weapon}).forEach(name=>names.add(name));
 for(const name of names) {
  const response=await request.get(`/assets/animation/run-${name}.json`);
  expect(response.ok()).toBe(true);
  const atlas=await response.json();
  for(const direction of ['S','SW','W','NW','N','NE','E','SE'])
   for(let frame=0;frame<6;frame++)
    expect(atlas.frames[`run/${name}/${direction}/0${frame}`].frame.w).toBe(192);
 }
 await page.goto('/animation-lab');
 await page.getByRole('button',{name:'暂停动画'}).click();
 await page.getByLabel('动作',{exact:true}).selectOption('run');
 await expect(page.getByLabel('播放速度')).toHaveValue('12');
 for(let frame=1;frame<=6;frame++) {
  await expect(page.getByLabel('当前帧')).toHaveText(`帧 ${frame} / 6`);
  await page.getByRole('button',{name:'下一帧',exact:true}).click();
 }
 await expect(page.getByLabel('当前帧')).toHaveText('帧 1 / 6');
 for(const outfit of ['scholar','warden']) for(const hair of ['ivory','midnight']) {
  await page.getByLabel('动画衣装').selectOption(outfit);
  await page.getByLabel('动画发型').selectOption(hair);
  await page.getByLabel('法杖动画层').uncheck();
  await page.getByLabel('法杖动画层').check();
 }
});
