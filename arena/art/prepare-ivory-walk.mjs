import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { digest } from './equipment-pipeline.mjs';
import { directions, frameName } from './animation-spec.mjs';
import { extractSourceSprites } from './source-sprites.mjs';

const art = new URL('./', import.meta.url);
const output = new URL('../client/public/assets/animation/', import.meta.url);
const sourceBytes = await readFile(new URL('source/walk-hair-ivory.png', art));
const promptBytes = await readFile(new URL('source/walk-hair-ivory-prompt.txt', art));
const { sprites, sourceSize } = await extractSourceSprites(sourceBytes, {
  columns: 4, rows: 8,
  keepPixel: (r, g, b, a) => a > 96 && Math.max(r, g, b) - Math.min(r, g, b) > 8
    && !(r > 180 && g < 80) && !(r > 170 && b > 150 && g < 110)
    && !(r > 190 && g > 170 && b < 60),
});
// Crown/ear-line registration for the eight authored body views; x,y,w,h.
const placements = [
  [[55,10,83,70],[55,10,83,70],[55,11,83,70],[55,10,83,70]],
  [[50,10,83,70],[51,10,83,70],[50,11,83,70],[51,10,83,70]],
  [[49,10,82,70],[49,10,82,70],[49,11,82,70],[49,10,82,70]],
  [[49,10,82,72],[52,11,82,72],[49,10,82,72],[52,11,82,72]],
  [[53,10,83,74],[54,10,83,74],[53,11,83,74],[54,10,83,74]],
  [[55,10,82,72],[54,11,82,72],[55,11,82,72],[54,11,82,72]],
  [[60,10,82,70],[59,10,82,70],[60,11,82,70],[59,10,82,70]],
  [[61,10,83,70],[61,10,83,70],[61,11,83,70],[61,10,83,70]],
];
const frames = [], composites = [];
for (const { row, col, image, crop } of sprites) {
  const [x, y, w, h] = placements[row][col];
  const piece = await sharp(image).resize(w, h, { fit: 'fill' }).png().toBuffer();
  composites.push({ input: piece, left: col * 196 + 2 + x, top: row * 196 + 2 + y });
  frames.push({ name: frameName('walk', 'hair-ivory', directions[row], col),
    crop, placement: { x, y, w, h } });
}
const image = await sharp({ create: { width: 784, height: 1568, channels: 4, background: '#00000000' } })
  .composite(composites).png().toBuffer();
const bodyAtlas = await readFile(new URL('walk-body.json', output), 'utf8');
const atlas = JSON.parse(bodyAtlas.replaceAll('walk/body/', 'walk/hair-ivory/').replace('walk-body.png', 'walk-hair-ivory.png'));
atlas.meta.app = 'arena-paper-doll-pipeline';
const recipe = { schemaVersion: 1, action: 'walk', layer: 'hair-ivory',
  source: 'walk-hair-ivory.png', sourceSize, sourceSha256: digest(sourceBytes),
  promptSha256: digest(promptBytes), frames };
const json = value => JSON.stringify(value, null, 2) + '\n';
await writeFile(new URL('source/walk-hair-ivory-registration.json', art), json(recipe));
await writeFile(new URL('walk-hair-ivory.png', output), image);
await writeFile(new URL('walk-hair-ivory.json', output), json(atlas));
await writeFile(new URL('walk-hair-ivory.provenance.json', output), json({
  schemaVersion: 1, status: 'prototype', releaseApproved: false,
  sourceSha256: digest(sourceBytes), promptSha256: digest(promptBytes),
  recipeSha256: digest(Buffer.from(JSON.stringify(recipe))), atlasPngSha256: digest(image),
  generator: 'GPT Image 2 via proxy-imagegen', cell: [192, 192], anchor: [0.5, 0.9],
  review: '32 authored hair poses; crown/ear registration and face opening composed with body. Fine edge and side/back pose refinement remains.',
}));
const layers = await Promise.all(['walk-body.png', 'walk-outfit-scholar.png', 'walk-body-front.png']
  .map(name => readFile(new URL(name, output))));
await sharp(layers[0]).composite([...layers.slice(1).map(input => ({ input })), { input: image }])
  .png().toFile(new URL('walk-scholar-ivory-preview.png', art).pathname);
const coveragePath = new URL('coverage.json', output);
const coverage = JSON.parse(await readFile(coveragePath, 'utf8'));
for (const entry of coverage.coverage) if (entry.action === 'walk' && entry.layer === 'hair-ivory') {
  entry.status = 'prototype'; entry.atlas = 'walk-hair-ivory.json';
  entry.frames = atlas.animations[`walk/hair-ivory/${entry.direction}`];
}
coverage.contentVersion = 'arena-animation-2026-11-05.2';
coverage.review.paperDoll = 'Walk body + scholar vest + foreground hands + ivory hair assembled in 32 poses. Warden, midnight hair, staff and other actions remain in production queue.';
coverage.equipmentSources = coverage.equipmentSources.filter(entry => entry.layer !== 'hair-ivory');
coverage.equipmentSources.push({ layer: 'hair-ivory', path: 'arena/art/source/walk-hair-ivory.png',
  sha256: digest(sourceBytes), provenance: 'walk-hair-ivory.provenance.json' });
await writeFile(coveragePath, json(coverage));
console.log('Packed 32 ivory hair poses and full scholar composition preview.');
