import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { digest } from './equipment-pipeline.mjs';
import { directions, frameName } from './animation-spec.mjs';

export const art = new URL('./', import.meta.url);
export const output = new URL('../client/public/assets/animation/', import.meta.url);
const json = value => JSON.stringify(value, null, 2) + '\n';

export async function buildRegisteredLayer({ layer, sprites, placements, sourceSize, sourceBytes, promptBytes, review }) {
  const frames = [], composites = [];
  for (const { row, col, image, crop } of sprites) {
    const [x, y, w, h] = placements[row][col];
    const piece = await sharp(image).resize(w, h, { fit: 'fill' }).png().toBuffer();
    composites.push({ input: piece, left: col * 196 + 2 + x, top: row * 196 + 2 + y });
    frames.push({ name: frameName('walk', layer, directions[row], col),
      crop, placement: { x, y, w, h } });
  }
  const image = await sharp({ create: { width: 784, height: 1568, channels: 4, background: '#00000000' } })
    .composite(composites).png().toBuffer();
  const bodyAtlas = await readFile(new URL('walk-body.json', output), 'utf8');
  const atlas = JSON.parse(bodyAtlas.replaceAll('walk/body/', `walk/${layer}/`).replace('walk-body.png', `walk-${layer}.png`));
  atlas.meta.app = 'arena-paper-doll-pipeline';
  const recipe = { schemaVersion: 1, action: 'walk', layer,
    source: `walk-${layer}.png`, sourceSize, sourceSha256: digest(sourceBytes),
    promptSha256: digest(promptBytes), frames };
  await writeFile(new URL(`source/walk-${layer}-registration.json`, art), json(recipe));
  await writeFile(new URL(`walk-${layer}.png`, output), image);
  await writeFile(new URL(`walk-${layer}.json`, output), json(atlas));
  await writeFile(new URL(`walk-${layer}.provenance.json`, output), json({
    schemaVersion: 1, status: 'prototype', releaseApproved: false,
    sourceSha256: digest(sourceBytes), promptSha256: digest(promptBytes),
    recipeSha256: digest(Buffer.from(JSON.stringify(recipe))), atlasPngSha256: digest(image),
    generator: 'GPT Image 2 via proxy-imagegen', cell: [192, 192], anchor: [0.5, 0.9], review,
  }));
  return { image, atlas };
}

export async function registerLayerCoverage({ layer, atlas, sourceBytes, contentVersion, paperDoll }) {
  const coveragePath = new URL('coverage.json', output);
  const coverage = JSON.parse(await readFile(coveragePath, 'utf8'));
  for (const entry of coverage.coverage) if (entry.action === 'walk' && entry.layer === layer) {
    entry.status = 'prototype'; entry.atlas = `walk-${layer}.json`;
    entry.frames = atlas.animations[`walk/${layer}/${entry.direction}`];
  }
  coverage.contentVersion = contentVersion;
  coverage.review.paperDoll = paperDoll;
  coverage.equipmentSources = coverage.equipmentSources.filter(entry => entry.layer !== layer);
  coverage.equipmentSources.push({ layer, path: `arena/art/source/walk-${layer}.png`,
    sha256: digest(sourceBytes), provenance: `walk-${layer}.provenance.json` });
  await writeFile(coveragePath, json(coverage));
}
