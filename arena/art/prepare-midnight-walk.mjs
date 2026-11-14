import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { extractSourceSprites } from './source-sprites.mjs';
import { art, output, buildRegisteredLayer, registerLayerCoverage } from './registered-layer.mjs';

const sourceBytes = await readFile(new URL('source/walk-hair-midnight.png', art));
const promptBytes = await readFile(new URL('source/walk-hair-midnight-prompt.txt', art));
const { sprites, sourceSize } = await extractSourceSprites(sourceBytes, {
  columns: 4, rows: 8,
  // Retain blue ink and navy highlights; reject neutral background/edge contamination.
  keepPixel: (r, g, b, a) => a > 96 && b > r + 5 && b >= g && r < 180,
});
// Reuse the reviewed crown/ear-line coordinate contract, not the ivory pixels.
const ivory = JSON.parse(await readFile(new URL('source/walk-hair-ivory-registration.json', art), 'utf8'));
const placements = Array.from({ length: 8 }, (_, row) =>
  ivory.frames.slice(row * 4, row * 4 + 4).map(({ placement: { x, y, w, h } }) => [x, y, w, h]));
const { image, atlas } = await buildRegisteredLayer({
  layer: 'hair-midnight', sprites, placements, sourceSize, sourceBytes, promptBytes,
  review: '32 independently generated midnight hair poses registered to the shared crown/ear-line. Directional silhouettes and face cutouts require final human approval; body proportion remains prototype.',
});
for (const outfit of ['scholar', 'warden']) {
  const layers = await Promise.all(['weapon-staff-back', 'body', `outfit-${outfit}`, 'weapon-staff-front', 'body-front']
    .map(name => readFile(new URL(`walk-${name}.png`, output))));
  await sharp(layers[0]).composite([...layers.slice(1).map(input => ({ input })), { input: image }])
    .png().toFile(new URL(`walk-${outfit}-midnight-staff-preview.png`, art).pathname);
}
await registerLayerCoverage({ layer: 'hair-midnight', atlas, sourceBytes,
  contentVersion: 'arena-animation-2026-11-14.1',
  paperDoll: 'Walk body, scholar/warden outfits, ivory/midnight hair and directional staff are registered 32-frame prototypes. Other actions and final visual approval remain outstanding.' });
console.log('Packed 32 midnight hair poses and both dressed staff composition previews.');
