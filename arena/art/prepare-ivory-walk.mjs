import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { extractSourceSprites } from './source-sprites.mjs';
import { art, output, buildRegisteredLayer, registerLayerCoverage } from './registered-layer.mjs';

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
const { image, atlas } = await buildRegisteredLayer({
  layer: 'hair-ivory', sprites, placements, sourceSize, sourceBytes, promptBytes,
  review: '32 authored hair poses; crown/ear registration and face opening composed with body. Fine edge and side/back pose refinement remains.',
});
const layers = await Promise.all(['walk-body.png', 'walk-outfit-scholar.png', 'walk-body-front.png']
  .map(name => readFile(new URL(name, output))));
await sharp(layers[0]).composite([...layers.slice(1).map(input => ({ input })), { input: image }])
  .png().toFile(new URL('walk-scholar-ivory-preview.png', art).pathname);
await registerLayerCoverage({ layer: 'hair-ivory', atlas, sourceBytes,
  contentVersion: 'arena-animation-2026-11-05.2',
  paperDoll: 'Walk body + scholar vest + foreground hands + ivory hair assembled in 32 poses. Warden, midnight hair, staff and other actions remain in production queue.' });
console.log('Packed 32 ivory hair poses and full scholar composition preview.');
