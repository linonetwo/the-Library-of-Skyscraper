import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { digest, buildEquipment } from './equipment-pipeline.mjs';
import { directions, frameName } from './animation-spec.mjs';

// Authored registration against the current 192px body cells: x, y, width, height.
const placements = [
  [[65,82,61,49],[67,82,57,49],[66,83,60,49],[68,82,57,49]],
  [[66,82,52,49],[68,82,49,49],[65,83,53,49],[68,82,49,49]],
  [[67,81,44,49],[68,81,44,49],[66,82,46,49],[68,81,44,49]],
  [[65,83,56,49],[69,84,54,49],[65,82,56,49],[69,84,54,49]],
  [[65,83,60,49],[68,83,56,49],[65,84,60,49],[68,83,56,49]],
  [[68,82,56,49],[68,84,54,49],[68,83,56,49],[68,84,54,49]],
  [[81,81,44,49],[80,81,44,49],[79,82,46,49],[80,81,44,49]],
  [[72,82,53,49],[74,82,49,49],[72,83,53,49],[74,82,49,49]],
];
const source = new URL('./source/walk-outfit-scholar.png', import.meta.url);
const { data, info } = await sharp(await readFile(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const [r, g, b, a] = data.subarray(i, i + 4);
  const chroma = (r > 170 && b > 150 && g < 110) ||
    (r > 190 && g > 170 && b < 60) || (r > 180 && g < 65 && b < 65);
  data[i + 3] = chroma || a < 96 ? 0 : a;
}
const cleaned = await sharp(data, { raw: info }).png().toBuffer();
const cleanPath = new URL('./source/walk-outfit-scholar-clean.png', import.meta.url);
await writeFile(cleanPath, cleaned);
const frames = [];
for (const [row, direction] of directions.entries()) {
  for (let col = 0; col < 4; col++) {
    const left = Math.round(col * info.width / 4), top = Math.round(row * info.height / 8);
    const right = Math.round((col + 1) * info.width / 4), bottom = Math.round((row + 1) * info.height / 8);
    let x0 = right, y0 = bottom, x1 = left, y1 = top;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 96) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    const [x, y, w, h] = placements[row][col];
    frames.push({ name: frameName('walk', 'outfit-scholar', direction, col),
      crop: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, placement: { x, y, w, h } });
  }
}
const prompt = await readFile(new URL('./source/walk-outfit-scholar-prompt.txt', import.meta.url));
const recipe = { schemaVersion: 1, action: 'walk', layer: 'outfit-scholar',
  source: 'walk-outfit-scholar-clean.png', prompt: 'walk-outfit-scholar-prompt.txt',
  sourceSha256: digest(cleaned), promptSha256: digest(prompt), sourceSize: [info.width, info.height], frames };
const recipePath = new URL('./source/walk-outfit-scholar-registration.json', import.meta.url);
await writeFile(recipePath, JSON.stringify(recipe, null, 2) + '\n');
const output = new URL('../client/public/assets/animation/', import.meta.url);
const result = await buildEquipment(recipePath.pathname, output.pathname);
const body = await readFile(new URL('../client/public/assets/animation/walk-body.png', import.meta.url));
// Restore the authored visible hands above the vest, using the body's own pixels.
const { data: bodyPixels, info: bodyInfo } = await sharp(body).raw().toBuffer({ resolveWithObject: true });
const hands = Buffer.alloc(bodyPixels.length);
for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
  for (let y = 90; y < 140; y++) for (let x = 45; x < 147; x++) {
    const px = col * 196 + 2 + x, py = row * 196 + 2 + y;
    const offset = (py * bodyInfo.width + px) * 4;
    const [r, g, b, a] = bodyPixels.subarray(offset, offset + 4);
    if (a > 96 && r > 145 && g > 95 && b > 65 && r - g > 12 && g - b > 8) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const target = ((py + dy) * bodyInfo.width + px + dx) * 4;
        bodyPixels.copy(hands, target, target, target + 4);
      }
    }
  }
}
const handImage = await sharp(hands, { raw: bodyInfo }).png().toBuffer();
await writeFile(new URL('walk-body-front.png', output), handImage);
const handAtlas = JSON.parse(JSON.stringify(result.atlas).replaceAll('outfit-scholar', 'body-front'));
await writeFile(new URL('walk-body-front.json', output),
  JSON.stringify(handAtlas, null, 2) + '\n');
await sharp(body).composite([{ input: result.image }, { input: handImage }]).png()
  .toFile(new URL('./walk-scholar-preview.png', import.meta.url).pathname);
const coverageFile = new URL('coverage.json', output);
const coverage = JSON.parse(await readFile(coverageFile, 'utf8'));
for (const entry of coverage.coverage) {
  if (entry.action === 'walk' && entry.layer === 'outfit-scholar') {
    entry.status = 'prototype';
    entry.atlas = 'walk-outfit-scholar.json';
    entry.frames = result.atlas.animations[`walk/outfit-scholar/${entry.direction}`];
  }
}
coverage.contentVersion = 'arena-animation-2026-11-05.1';
coverage.generatedOn = '2026-11-05';
coverage.review.paperDoll = 'Walk body + scholar vest + foreground hands assembled in 32 poses. Hairstyle, warden and staff layers remain in production queue.';
coverage.review.alignment = 'Scholar authored per-frame placements share cell anchor; original hand pixels restored as body-front. Vest width and side/back registration need art refinement.';
coverage.equipmentSources = [{ layer: 'outfit-scholar',
  path: 'arena/art/source/walk-outfit-scholar.png',
  sha256: digest(await readFile(source)), provenance: 'walk-outfit-scholar.provenance.json' }];
coverage.auxiliaryLayers = [{ layer: 'body-front', action: 'walk', atlas: 'walk-body-front.json',
  purpose: 'Visible forearms and hands composited above sleeveless outfits; sampled from body source.' }];
await writeFile(coverageFile, JSON.stringify(coverage, null, 2) + '\n');
console.log('Packed 32 scholar walk frames, foreground hands and body/outfit composition preview.');
