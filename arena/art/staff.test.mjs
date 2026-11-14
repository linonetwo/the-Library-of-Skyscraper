import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { output } from './registered-layer.mjs';
import { directions } from './animation-spec.mjs';

test('staff depth layers reconstruct all 32 poses at authored grip tracks', async () => {
  const read = name => readFile(new URL(name, output));
  const tracks = JSON.parse(await read('walk-weapon-staff.attachments.json'));
  const atlas = JSON.parse(await read('walk-weapon-staff.json'));
  const complete = await sharp(await read('walk-weapon-staff.png')).raw().toBuffer();
  const back = await sharp(await read('walk-weapon-staff-back.png')).raw().toBuffer();
  const front = await sharp(await read('walk-weapon-staff-front.png')).raw().toBuffer();
  assert.equal(tracks.attachments.length, 32);
  for (const [index, entry] of tracks.attachments.entries()) {
    const row = Math.floor(index / 4), col = index % 4;
    assert.equal(entry.frame, `walk/weapon-staff/${directions[row]}/${String(col).padStart(2, '0')}`);
    assert.deepEqual(atlas.frames[entry.frame].anchor, { x: 0.5, y: 0.9 });
    let gripPixels = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = col * 196 + 2 + entry.grip.x + dx, y = row * 196 + 2 + entry.grip.y + dy;
      if (complete[(y * 784 + x) * 4 + 3] > 96) gripPixels++;
    }
    assert(gripPixels > 0, `${entry.frame} intersects its hand grip`);
    const start = row * 196 * 784 * 4, end = (row + 1) * 196 * 784 * 4;
    const visible = entry.depth === 'back' ? back : front;
    const empty = entry.depth === 'back' ? front : back;
    assert.deepEqual(visible.subarray(start, end), complete.subarray(start, end));
    assert(empty.subarray(start, end).every(value => value === 0));
  }
});
