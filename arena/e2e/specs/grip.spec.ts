import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { animationLayers, animationLayerNames } from '../../client/src/walkLayers';

test('grip atlases use the shared action index and equip-only foreground ordering', async () => {
 for (const action of ['idle', 'walk'] as const) {
  expect(animationLayerNames[action].filter(layer => layer === 'hand-grip')).toHaveLength(1);
  const atlas = JSON.parse(await readFile(`../client/public/assets/animation/${action}-hand-grip.json`, 'utf8'));
  expect(Object.keys(atlas.frames)).toHaveLength(32);
  for (const direction of ['N','NE','E','SE','S','SW','W','NW']) {
   for (let frame = 0; frame < 4; frame++) {
    expect(atlas.frames[`${action}/hand-grip/${direction}/${String(frame).padStart(2, '0')}`]).toBeTruthy();
   }
  }
  for (const outfit of ['scholar','warden'] as const) {
   for (const hair of ['ivory','midnight'] as const) {
    const layers = animationLayers(action, {outfit,hair,weapon:true});
    expect(layers.indexOf('hand-grip')).toBe(layers.indexOf('body-front')+1);
    expect(layers.indexOf('hand-grip')).toBeLessThan(layers.indexOf(`hair-${hair}-front`));
    expect(animationLayers(action, {outfit,hair,weapon:false})).not.toContain('hand-grip');
   }
  }
 }
});
