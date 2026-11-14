import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

test('all six paper-doll layers are aligned, transparent and inside the packed atlas', async () => {
  const base = new URL('../client/public/assets/', import.meta.url);
  const atlas = JSON.parse(await readFile(new URL('doll-atlas.json', base)));
  assert.equal(Object.keys(atlas.frames).length, 6);
  const image = sharp(await readFile(new URL('doll-atlas.png', base)));
  const metadata = await image.metadata();
  assert.equal(metadata.hasAlpha, true);
  for (const { frame } of Object.values(atlas.frames)) {
    assert.equal(frame.w, 384);
    assert.equal(frame.h, 384);
    assert.ok(frame.x >= 2 && frame.y >= 2);
    assert.ok(frame.x + frame.w < metadata.width);
    assert.ok(frame.y + frame.h < metadata.height);
    const stats = await image.clone().extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h }).stats();
    assert.equal(stats.channels[3].min, 0);
    assert.ok(stats.channels[3].max > 240);
  }
});
