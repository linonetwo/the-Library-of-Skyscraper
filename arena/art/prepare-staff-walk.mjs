import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { extractSourceSprites } from './source-sprites.mjs';
import { art, output, buildRegisteredLayer, registerLayerCoverage } from './registered-layer.mjs';
import { handTracks, sourceGripTracks, staffDepth, carryLean } from './staff-registration.mjs';
import { splitStaffDepth, createStaffPreview } from './staff-layers.mjs';
import { directions, frameName } from './animation-spec.mjs';

const sourceBytes = await readFile(new URL('source/walk-weapon-staff.png', art));
const promptBytes = await readFile(new URL('source/walk-weapon-staff-prompt.txt', art));
const { sprites, sourceSize } = await extractSourceSprites(sourceBytes, {
  columns: 4, rows: 8,
  keepPixel: (r, g, b, a) => a > 96 && !(r > 180 && g < 80)
    && !(r > 170 && b > 150 && g < 110) && !(r > 190 && g > 170 && b < 60),
});
const placements = directions.map(() => []);
const attachments = [];
for (const sprite of sprites) {
  const { row, col, crop } = sprite;
  const left = Math.round(col * sourceSize[0] / 4), top = Math.round(row * sourceSize[1] / 8);
  const [sourceX, sourceY] = sourceGripTracks[row][col];
  const gx = sourceX - (crop.x - left), gy = sourceY - (crop.y - top);
  const angle = carryLean[row][col], radians = angle * Math.PI / 180;
  const rotated = await sharp(sprite.image).rotate(angle, { background: '#00000000' }).png().toBuffer();
  const metadata = await sharp(rotated).metadata();
  const gripX = metadata.width / 2 + (gx - crop.w / 2) * Math.cos(radians) - (gy - crop.h / 2) * Math.sin(radians);
  const gripY = metadata.height / 2 + (gx - crop.w / 2) * Math.sin(radians) + (gy - crop.h / 2) * Math.cos(radians);
  const scale = 0.58, w = Math.round(metadata.width * scale), h = Math.round(metadata.height * scale);
  const [handX, handY] = handTracks[row][col];
  const x = Math.round(handX - gripX * w / metadata.width), y = Math.round(handY - gripY * h / metadata.height);
  placements[row][col] = [x, y, w, h];
  sprite.image = rotated;
  attachments.push({ frame: frameName('walk', 'weapon-staff', directions[row], col),
    hand: 'right', grip: { x: handX, y: handY }, sourceGrip: { x: sourceX, y: sourceY },
    carryLeanDegrees: angle, depth: staffDepth[row] });
}
const { image, atlas } = await buildRegisteredLayer({
  layer: 'weapon-staff', sprites, placements, sourceSize, sourceBytes, promptBytes,
  review: '32 directional staff poses registered to authored right-hand tracks, with direction-specific front/back layers. Grip closure and carry posture remain in art refinement.',
});
const split = await splitStaffDepth(image, atlas);
await createStaffPreview(split);
await writeFile(new URL('walk-weapon-staff.attachments.json', output), JSON.stringify({
  schemaVersion: 1, action: 'walk', cell: [192, 192],
  layerOrder: ['weapon-staff-back', 'body', 'outfit', 'weapon-staff-front', 'body-front', 'hair'],
  attachments,
}, null, 2) + '\n');
await registerLayerCoverage({ layer: 'weapon-staff', atlas, sourceBytes,
  contentVersion: 'arena-animation-2026-11-05.4',
  paperDoll: 'Walk body, scholar and warden outfits, ivory hair and held staff assembled across 32 poses. Midnight hair and other actions remain in production queue.' });
const coveragePath = new URL('coverage.json', output);
const coverage = JSON.parse(await readFile(coveragePath, 'utf8'));
coverage.auxiliaryLayers = coverage.auxiliaryLayers.filter(entry => !entry.layer.startsWith('weapon-staff'));
for (const depth of ['back', 'front']) coverage.auxiliaryLayers.push({
  layer: `weapon-staff-${depth}`, action: 'walk', atlas: `walk-weapon-staff-${depth}.json`,
  purpose: `Directional ${depth} occlusion for the right-hand staff; opposite-depth rows are transparent.`,
});
await writeFile(coveragePath, JSON.stringify(coverage, null, 2) + '\n');
console.log('Packed 32 held staff poses, grip tracks and front/back layers.');
