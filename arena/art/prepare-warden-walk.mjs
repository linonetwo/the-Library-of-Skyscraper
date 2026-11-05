import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { extractSourceSprites } from './source-sprites.mjs';
import { art, output, buildRegisteredLayer, registerLayerCoverage } from './registered-layer.mjs';

const sourceBytes = await readFile(new URL('source/walk-outfit-warden.png', art));
const promptBytes = await readFile(new URL('source/walk-outfit-warden-prompt.txt', art));
const { sprites, sourceSize } = await extractSourceSprites(sourceBytes, {
  columns: 4, rows: 8,
  keepPixel: (r, g, b, a) => a > 96 && !(r > 180 && g < 80)
    && !(r > 170 && b > 150 && g < 110) && !(r > 190 && g > 170 && b < 60),
});
// Shared torso registration with scholar garments, expanded for shoulder caps.
const placements = [
  [[62,81,67,55],[64,81,63,55],[63,82,66,55],[65,81,63,55]],
  [[63,81,58,55],[65,81,55,55],[62,82,59,55],[65,81,55,55]],
  [[65,80,48,55],[66,80,48,55],[64,81,50,55],[66,80,48,55]],
  [[62,82,62,55],[66,83,60,55],[62,81,62,55],[66,83,60,55]],
  [[62,82,66,55],[65,82,62,55],[62,83,66,55],[65,82,62,55]],
  [[65,81,62,55],[65,83,60,55],[65,82,62,55],[65,83,60,55]],
  [[79,80,48,55],[78,80,48,55],[77,81,50,55],[78,80,48,55]],
  [[69,81,59,55],[71,81,55,55],[69,82,59,55],[71,81,55,55]],
];
const { image, atlas } = await buildRegisteredLayer({
  layer: 'outfit-warden', sprites, placements, sourceSize, sourceBytes, promptBytes,
  review: '32 authored leather-armor poses registered to body. Shoulder-cap occlusion and side/back direction refinement remains.',
});
const layers = await Promise.all(['walk-body.png', 'walk-body-front.png', 'walk-hair-ivory.png']
  .map(name => readFile(new URL(name, output))));
await sharp(layers[0]).composite([{ input: image }, ...layers.slice(1).map(input => ({ input }))])
  .png().toFile(new URL('walk-warden-ivory-preview.png', art).pathname);
await registerLayerCoverage({ layer: 'outfit-warden', atlas, sourceBytes,
  contentVersion: 'arena-animation-2026-11-05.3',
  paperDoll: 'Walk body, scholar and warden outfits, foreground hands and ivory hair assembled in 32 poses. Midnight hair, staff and other actions remain in production queue.' });
console.log('Packed 32 warden armor poses and full composition preview.');
