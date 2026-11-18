import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { directions, layers, modules, frameName } from './animation-spec.mjs';
import { approvalRecord, contentVersion, approvedActions } from './art-approval.mjs';

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
    if (approvedActions.includes(entry.action)) {
      assert.equal(entry.status,'approved');assert.equal(entry.releaseApproved,true);
      assert.equal(entry.approvalRecord,approvalRecord);assert.equal(entry.contentVersion,contentVersion);
      assert.equal(entry.frames.length, entry.expectedFrames);
      const atlas=await json(entry.atlas);
      assert.deepEqual(entry.frames,atlas.animations[`${entry.action}/${entry.layer}/${entry.direction}`]);
      for(const frame of entry.frames)assert(atlas.frames[frame]);
    } else { assert.equal(entry.status, 'missing'); assert.equal(entry.releaseApproved,false);assert.equal(entry.frames.length, 0); assert.equal(entry.atlas, null); }
  }
  assert.equal(c.releaseReady, true);
  assert.equal(c.allPlannedActionsReady,false);
  assert.deepEqual(c.releaseScope,{version:'0.2.0',actions:approvedActions,appearanceCombinations:8,compositeFrames:512});
  assert.equal(c.coverage.filter(x => x.status === 'approved').length, 96);
  assert.equal(c.auxiliaryLayers.length,16);
  for(const entry of c.auxiliaryLayers) {
    assert(approvedActions.includes(entry.action));assert.equal(entry.status,'approved');
    assert.equal(entry.approvalRecord,approvalRecord);
    assert.equal(Object.keys((await json(entry.atlas)).frames).length,32);
  }
});
test('approved walk atlas contains 32 distinct nonempty RGBA frames within padded bounds', async () => {
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
  assert.equal(c.source.path,'arena/art/source/four-head-walk-body.png');
  const source = await readFile(new URL('source/four-head-walk-body.png', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), c.source.sha256);
});
test('outfits, both hair sets and foreground hands share the 32 body registrations', async () => {
  const body = await json('walk-body.json');
  for (const layer of ['outfit-scholar', 'outfit-warden', 'body-front', 'hair-ivory', 'hair-midnight']) {
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
test('midnight hair has 32 unique poses, transparent borders and reproducible source hashes', async () => {
  const atlas = await json('walk-hair-midnight.json');
  const image = await readFile(new URL(atlas.meta.image, base));
  const provenance = await json('walk-hair-midnight.provenance.json');
  const source = await readFile(new URL('source/walk-hair-midnight.png', import.meta.url));
  assert.equal(provenance.sourceSha256, createHash('sha256').update(source).digest('hex'));
  assert.equal(provenance.atlasPngSha256, createHash('sha256').update(image).digest('hex'));
  assert.equal(provenance.releaseApproved, true);
  assert.equal(provenance.approvalRecord,approvalRecord);
  const hashes = new Set();
  for (const { frame: { x, y, w, h } } of Object.values(atlas.frames)) {
    const raw = await sharp(image).extract({ left: x, top: y, width: w, height: h }).raw().toBuffer();
    hashes.add(createHash('sha256').update(raw).digest('hex'));
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      if (px === 0 || py === 0 || px === w - 1 || py === h - 1)
        assert.equal(raw[(py * w + px) * 4 + 3], 0, 'No artwork leaks across cell borders');
    }
  }
  assert.equal(hashes.size, 32);
});
