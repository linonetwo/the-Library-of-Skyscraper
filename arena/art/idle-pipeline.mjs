import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { directions, frameName, modules } from './animation-spec.mjs';

export const art = new URL('./', import.meta.url);
export const output = new URL('../client/public/assets/animation/', import.meta.url);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = value => JSON.stringify(value, null, 2) + '\n';
export const clearCell = () => sharp({ create: { width: 192, height: 192, channels: 4, background: '#00000000' } });
export const keepPixel = (r, g, b, a) => a > 96
  && !(r > 170 && b > 150 && g < 110)
  && !(r > 190 && g > 170 && b < 65)
  && !(r > 180 && g < 80)
  && !(r > 238 && g > 238 && b > 238);

export async function place(image, [x, y, w, h]) {
  return clearCell().composite([{ input: await sharp(image).resize(w, h, { fit: 'fill' }).png().toBuffer(),
    left: x, top: y }]).png().toBuffer();
}

// Continuous, low-amplitude deformation of an authored STANDING source, never a walk frame.
// The body below the hip stays bit-identical, including both soles and boots.
export async function breathe(image, phase, { kind = 'body' } = {}) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.alloc(data.length);
  const lift = [0, -0.8, -1.35, -0.55][phase];
  const sway = [0, 0.65, 0, -0.65][phase];
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const upper = Math.max(0, Math.min(1, (132 - y) / 55));
    let sx = x, sy = y - lift * upper;
    if (kind === 'hair') sx -= sway * Math.max(0, Math.min(1, (y - 35) / 45));
    if (kind === 'cloth') sx -= sway * Math.max(0, Math.min(1, (y - 95) / 35));
    if (kind === 'body' || kind === 'cloth') sx = 96 + (sx - 96) / (1 + -lift * 0.008 * Math.max(0, 1 - Math.abs(y - 95) / 35));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    let alpha = 0; const rgb = [0, 0, 0];
    for (const [dx, dy, weight] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]) {
      const px = x0 + dx, py = y0 + dy;
      if (px < 0 || py < 0 || px >= 192 || py >= 192) continue;
      const p = (py * 192 + px) * 4, a = data[p + 3] / 255 * weight;
      alpha += a; for (let c = 0; c < 3; c++) rgb[c] += data[p+c] * a;
    }
    const dst = (y * 192 + x) * 4;
    if (alpha) for (let c = 0; c < 3; c++) result[dst+c] = Math.round(rgb[c] / alpha);
    result[dst+3] = Math.round(alpha * 255);
  }
  return sharp(result, { raw: info }).png().toBuffer();
}

export async function foregroundHands(image) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.alloc(data.length);
  for (let y = 90; y < 134; y++) for (let x = 45; x < 147; x++) {
    const offset = (y * 192 + x) * 4, [r,g,b,a] = data.subarray(offset, offset + 4);
    if (a > 96 && r > 145 && g > 95 && b > 65 && r - g > 12 && g - b > 8)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const p = ((y + dy) * 192 + x + dx) * 4;
        data.copy(result, p, p, p + 4);
      }
  }
  return sharp(result, { raw: info }).png().toBuffer();
}

export async function packLayer(layer, cells, provenance, action = 'idle') {
  const composites = [], frames = {}, animations = {},columns=modules[action].frames,width=196*columns;
  for (const [row, direction] of directions.entries()) {
    const key = `${action}/${layer}/${direction}`; animations[key] = [];
    for (let col = 0; col < columns; col++) {
      const name = frameName(action, layer, direction, col), x = col * 196 + 2, y = row * 196 + 2;
      composites.push({ input: cells[row][col], left: x, top: y });
      frames[name] = { frame: { x, y, w: 192, h: 192 }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: 192, h: 192 }, sourceSize: { w: 192, h: 192 }, anchor: { x: 0.5, y: 0.9 } };
      animations[key].push(name);
    }
  }
  const image = await sharp({ create: { width, height: 1568, channels: 4, background: '#00000000' } })
    .composite(composites).png().toBuffer();
  const atlas = { frames, animations, meta: { app: 'arena-idle-paper-doll-pipeline', version: '1',
    image: `${action}-${layer}.png`, format: 'RGBA8888', size: { w: width, h: 1568 }, scale: '1' } };
  await writeFile(new URL(`${action}-${layer}.png`, output), image);
  await writeFile(new URL(`${action}-${layer}.json`, output), json(atlas));
  await writeFile(new URL(`${action}-${layer}.provenance.json`, output), json({
    schemaVersion: 1, action, layer, status: 'prototype', releaseApproved: false,
    generator: 'GPT Image 2 via proxy-imagegen', ...provenance,
    atlasPngSha256: digest(image), cell: [192, 192], anchor: [0.5, 0.9],
  }));
  return { image, atlas };
}

export async function sourceProvenance(source, prompt, method) {
  return { source: `arena/art/source/${source}`, sourceSha256: digest(await readFile(new URL(`source/${source}`, art))),
    promptSha256: digest(await readFile(new URL(`source/${prompt}`, art))), method };
}
