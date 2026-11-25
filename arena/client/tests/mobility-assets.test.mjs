import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { animationLayers } from '../src/walkLayers.ts';

const root = new URL('../public/assets/iso-v050-mobility/', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
test('reviewed mobility pilot has every registered frame for all independent appearances', async () => {
  const index = JSON.parse(await readFile(new URL('../public/assets/iso-v030-base/index.json', import.meta.url), 'utf8'));
  for (const action of ['run', 'jump']) {
    const descriptor = await json(`${action}/atlas-budget.json`);
    assert.deepEqual(descriptor.directions, ['NE', 'SW']);
    assert.deepEqual(descriptor.groundPivot, [96, 172.8]);
    assert.equal(descriptor.clip.frameCount, action === 'run' ? 16 : 8);
    assert.equal(descriptor.clip.frameDurationsMs.reduce((sum, n) => sum + n, 0), action === 'run' ? 500 : 2000);
    assert.equal(index.clips.find(clip => clip.action === action).root, `/assets/iso-v050-mobility/${action}`);
    const frames = new Set();
    for (const layer of descriptor.layers) for (const page of layer.pages) {
      const atlas = await json(`${action}/${page.json}`);
      Object.keys(atlas.frames).forEach(key => frames.add(key));
    }
    for (const direction of descriptor.directions)
      for (const outfit of ['scholar', 'warden'])
        for (const hair of ['ivory', 'midnight'])
          for (const weapon of [false, true]) {
            const layers = animationLayers('walk', { outfit, hair, weapon }, descriptor.activeLayers, descriptor, direction);
            assert.ok(layers.includes(weapon ? 'hand-grip' : 'hand-front'));
            assert.ok(!layers.includes(weapon ? 'hand-front' : 'hand-grip'));
            for (let frame = 0; frame < descriptor.clip.frameCount; frame++)
              for (const layer of layers) {
                const key = `${action}/${layer}/${direction}/${String(frame).padStart(2, '0')}`;
                assert.ok(frames.has(key), key);
              }
          }
  }
});
