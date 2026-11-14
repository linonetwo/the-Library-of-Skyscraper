import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { directions, frameName, modules } from './animation-spec.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * Independent cloth-layer packing, not an animation synthesizer.
 * Every frame uses an explicitly authored crop and placement. In particular,
 * the packer never recenters opaque bounds, mirrors poses or reuses front views.
 * Passing this technical validation never grants visual/release approval.
 */
export async function packEquipment({ sourceBytes, promptBytes, recipe }) {
  const size = 192, padding = 2, stride = size + padding * 2;
  if (recipe.schemaVersion !== 1 || recipe.action !== 'walk' || recipe.layer !== 'outfit-scholar') {
    throw new Error('Unsupported equipment recipe');
  }
  if (recipe.sourceSha256 !== digest(sourceBytes) || recipe.promptSha256 !== digest(promptBytes)) {
    throw new Error('Source/prompt hash changed; review registration before repacking');
  }
  const metadata = await sharp(sourceBytes).metadata();
  if (!metadata.hasAlpha) throw new Error('Equipment source must contain an alpha channel');
  if (metadata.width !== recipe.sourceSize[0] || metadata.height !== recipe.sourceSize[1]) {
    throw new Error('Source dimensions changed');
  }
  const required = directions.flatMap(direction =>
    Array.from({ length: modules.walk.frames }, (_, i) => frameName('walk', recipe.layer, direction, i)));
  if (recipe.frames.length !== required.length || new Set(recipe.frames.map(f => f.name)).size !== required.length) {
    throw new Error('Exactly 32 unique direction/frame registrations required');
  }
  const frames = {}, animations = {}, composites = [], hashes = new Set();
  for (let index = 0; index < required.length; index++) {
    const name = required[index], entry = recipe.frames.find(frame => frame.name === name);
    if (!entry) throw new Error(`Missing registration: ${name}`);
    const { crop, placement } = entry;
    const values = [crop?.x, crop?.y, crop?.w, crop?.h, placement?.x, placement?.y, placement?.w, placement?.h];
    if (!values.every(Number.isInteger) || crop.x < 0 || crop.y < 0 ||
        crop.w <= 0 || crop.h <= 0 || crop.x + crop.w > metadata.width || crop.y + crop.h > metadata.height ||
        placement.x < 0 || placement.y < 0 || placement.w <= 0 || placement.h <= 0 ||
        placement.x + placement.w > size || placement.y + placement.h > size) {
      throw new Error(`Invalid crop/placement: ${name}`);
    }
    const piece = await sharp(sourceBytes).extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h })
      .resize(placement.w, placement.h, { fit: 'fill' }).ensureAlpha().png().toBuffer();
    const cell = await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
      .composite([{ input: piece, left: placement.x, top: placement.y }]).raw().toBuffer();
    let opaque = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const alpha = cell[(y * size + x) * 4 + 3];
      if (alpha > 16) {
        opaque++;
        // This recipe is specifically a short sleeveless waistcoat. A long robe
        // needs its own reviewed recipe; silently expanding this guard is unsafe.
        if (y < 66 || y >= 145) throw new Error(`Head/leg transparency violation: ${name}`);
      }
    }
    if (opaque < 250) throw new Error(`Empty or undersized clothing frame: ${name}`);
    const hash = digest(cell);
    if (hashes.has(hash)) throw new Error(`Repeated still cannot count as a walk pose: ${name}`);
    hashes.add(hash);
    const x = index % 4 * stride + padding, y = Math.floor(index / 4) * stride + padding;
    const png = await sharp(cell, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
    composites.push({ input: png, left: x, top: y });
    frames[name] = { frame: { x, y, w: size, h: size }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: size, h: size }, sourceSize: { w: size, h: size },
      anchor: { x: 0.5, y: 0.9 } };
    const sequence = name.slice(0, name.lastIndexOf('/'));
    (animations[sequence] ??= []).push(name);
  }
  const imageName = `${recipe.action}-${recipe.layer}.png`;
  const image = await sharp({ create: { width: stride * 4, height: stride * 8, channels: 4, background: '#00000000' } })
    .composite(composites).png().toBuffer();
  return { image, atlas: { frames, animations, meta: {
    app: 'arena-equipment-pipeline', version: '1', image: imageName, format: 'RGBA8888',
    size: { w: stride * 4, h: stride * 8 }, scale: '1',
  } }, provenance: {
    schemaVersion: 1, status: 'prototype', releaseApproved: false,
    sourceSha256: digest(sourceBytes), promptSha256: digest(promptBytes),
    recipeSha256: digest(Buffer.from(JSON.stringify(recipe))), atlasPngSha256: digest(image),
    generator: 'GPT Image 2 via proxy-imagegen', cell: [size, size], anchor: [0.5, 0.9],
    visualApproval: 'Required: direction, gait, body fit, hand occlusion, edge quality. Hash uniqueness is not visual approval.',
  } };
}

export async function buildEquipment(recipePath, outputDirectory) {
  const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
  const directory = path.dirname(recipePath);
  const result = await packEquipment({ recipe,
    sourceBytes: await readFile(path.resolve(directory, recipe.source)),
    promptBytes: await readFile(path.resolve(directory, recipe.prompt)) });
  // Validate all frames before creating any deliverable.
  await mkdir(outputDirectory, { recursive: true });
  const stem = `${recipe.action}-${recipe.layer}`;
  await writeFile(path.join(outputDirectory, `${stem}.png`), result.image);
  await writeFile(path.join(outputDirectory, `${stem}.json`), JSON.stringify(result.atlas, null, 2) + '\n');
  await writeFile(path.join(outputDirectory, `${stem}.provenance.json`), JSON.stringify(result.provenance, null, 2) + '\n');
  return result;
}
