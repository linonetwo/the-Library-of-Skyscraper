import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { directions, layers, modules, frameName } from './animation-spec.mjs';

const base = new URL('../client/public/assets/animation/', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, base), 'utf8'));
test('animation coverage enumerates every action / equipment / direction without claiming placeholders complete', async () => {
  const c = await json('coverage.json');
  assert.deepEqual(c.directions, directions);
  assert.deepEqual(c.layers, layers);
  assert.deepEqual(c.modules, modules);
  assert.equal(c.coverage.length, directions.length * layers.length * Object.keys(modules).length);
  const keys = new Set();
  for (const entry of c.coverage) {
    const key = `${entry.action}/${entry.layer}/${entry.direction}`;
    assert(!keys.has(key)); keys.add(key);
    assert(modules[entry.action]); assert(layers.includes(entry.layer)); assert(directions.includes(entry.direction));
    assert.equal(entry.expectedFrames, modules[entry.action].frames);
    assert.equal(entry.releaseApproved, false);
    if (entry.status === 'prototype') {
      assert.equal(entry.action, 'walk'); assert(['body', 'outfit-scholar', 'outfit-warden', 'hair-ivory', 'weapon-staff'].includes(entry.layer));
      assert.equal(entry.frames.length, entry.expectedFrames);
    } else { assert.equal(entry.status, 'missing'); assert.equal(entry.frames.length, 0); assert.equal(entry.atlas, null); }
  }
  assert.equal(c.releaseReady, false);
  assert.equal(c.coverage.filter(x => x.status === 'prototype').length, 40);
});
test('prototype atlas contains 32 distinct nonempty RGBA frames within padded bounds', async () => {
  const atlas = await json('walk-body.json'), c = await json('coverage.json');
  const image = new URL(atlas.meta.image, base);
  const metadata = await sharp(await readFile(image)).metadata();
  assert.equal(metadata.width, atlas.meta.size.w); assert.equal(metadata.height, atlas.meta.size.h);
  assert.equal(metadata.hasAlpha, true);
  const hashes = new Set();
  assert.equal(Object.keys(atlas.frames).length, 32);
  for (const direction of directions) for (let i = 0; i < 4; i++) {
    const f = atlas.frames[frameName('walk', 'body', direction, i)];
    assert(f); assert.equal(f.rotated, false); assert.equal(f.trimmed, false);
    assert.deepEqual(f.anchor, { x: c.anchor[0], y: c.anchor[1] });
    const {x, y, w, h} = f.frame;
    assert(x >= c.padding && y >= c.padding && x + w + c.padding <= metadata.width && y + h + c.padding <= metadata.height);
    const raw = await sharp(await readFile(image)).extract({left:x, top:y, width:w, height:h}).raw().toBuffer();
    let opaque = 0, clear = 0;
    for (let p = 3; p < raw.length; p += 4) { if (raw[p] > 128) opaque++; if (raw[p] === 0) clear++; }
    assert(opaque > 1000); assert(clear > 1000);
    hashes.add(createHash('sha256').update(raw).digest('hex'));
  }
  assert.equal(hashes.size, 32, 'Duplicate stills cannot masquerade as gait frames');
});
test('generated source is preserved and checksum is reproducible', async () => {
  const c = await json('coverage.json');
  const source = await readFile(new URL('source/walk-body-eight-directions.png', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), c.source.sha256);
});
test('outfits, ivory hair and foreground hands share the 32 body registrations', async () => {
  const body = await json('walk-body.json');
  for (const layer of ['outfit-scholar', 'outfit-warden', 'body-front', 'hair-ivory']) {
    const atlas = await json(`walk-${layer}.json`);
    const image = await readFile(new URL(atlas.meta.image, base));
    assert.equal(Object.keys(atlas.frames).length, 32);
    for (const direction of directions) for (let i = 0; i < 4; i++) {
      const entry = atlas.frames[frameName('walk', layer, direction, i)];
      assert.deepEqual(entry, body.frames[frameName('walk', 'body', direction, i)]);
      const { x, y, w, h } = entry.frame;
      const pixels = await sharp(image).extract({ left: x, top: y, width: w, height: h }).raw().toBuffer();
      let visible = 0;
      for (let p = 3; p < pixels.length; p += 4) if (pixels[p] > 128) visible++;
      assert(visible > 50, `${layer}/${direction}/${i} has visible artwork`);
    }
  }
});
