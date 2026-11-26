import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { animationLayers } from '../src/walkLayers.ts';

const root = new URL('../public/assets/iso-v050-mobility/', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
test('reviewed eight-direction mobility has every registered frame for all independent appearances', async () => {
  const index = JSON.parse(await readFile(new URL('../public/assets/iso-v030-base/index.json', import.meta.url), 'utf8'));
  for (const action of ['run', 'jump']) {
    const descriptor = await json(`${action}/atlas-budget.json`);
    assert.deepEqual(descriptor.directions, ['S','SW','W','NW','N','NE','E','SE']);
    assert.deepEqual(descriptor.groundPivot, [96, 172.8]);
    assert.equal(descriptor.clip.frameCount, action === 'run' ? 16 : 8);
    assert.equal(descriptor.clip.frameDurationsMs.reduce((sum, n) => sum + n, 0), action === 'run' ? 500 : 2000);
    if(action==='run') assert.equal(descriptor.clip.cycleWorldStride,1.5);
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
            if(direction==='S') assert.ok(layers.includes('hand-left-front'));
            else assert.ok(!layers.includes('hand-left-front'));
            assert.ok(!layers.includes(weapon ? 'hand-front' : 'hand-grip'));
            for (let frame = 0; frame < descriptor.clip.frameCount; frame++)
              for (const layer of layers) {
                const key = `${action}/${layer}/${direction}/${String(frame).padStart(2, '0')}`;
                assert.ok(frames.has(key), key);
              }
          }
  }
});

test('registered mobility runtime pages match the frozen merged bytes', async () => {
  const freeze=JSON.parse(await readFile(new URL('../../art/tools/candidates/eight-mobility/freeze.json',import.meta.url),'utf8'));
  for(const action of ['run','jump']) {
    const hashes=await json(`${action}/source-hashes.json`);
    for(const [file,hash] of Object.entries(hashes)) {
      assert.equal(freeze.files[`merged/${action}/${file}`],hash);
      assert.equal(createHash('sha256').update(await readFile(new URL(`${action}/${file}`,root))).digest('hex'),hash);
    }
  }
});
