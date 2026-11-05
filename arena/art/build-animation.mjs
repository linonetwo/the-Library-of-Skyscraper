import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { directions, layers, modules, frameName } from './animation-spec.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(root, '../client/public/assets/animation');
const source = path.join(root, 'source/walk-body-eight-directions.png');
const bytes = await readFile(source);
const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== 887 || info.height !== 1774) throw new Error('Source dimensions changed: author must review crop and anchors.');
await mkdir(output, { recursive: true });
const size = 192, padding = 2, stride = size + padding * 2;
const frames = {}, animations = {}, composites = [];
// Only removes generator chroma contamination, never draws/reposes the character.
for (let i = 0; i < data.length; i += 4) {
  const [r, g, b, a] = data.subarray(i, i + 4);
  const chroma = (r > 170 && b > 150 && g < 110) ||
    (r > 190 && g > 170 && b < 60) || (r > 180 && g < 65 && b < 65);
  data[i + 3] = chroma || a < 96 ? 0 : a;
}
const clean = await sharp(data, { raw: info }).png().toBuffer();
for (const [row, direction] of directions.entries()) {
  animations[`walk/body/${direction}`] = [];
  for (let col = 0; col < 4; col++) {
    const left = Math.round(col * info.width / 4);
    const top = Math.round(row * info.height / 8);
    const width = Math.round((col + 1) * info.width / 4) - left;
    const height = Math.round((row + 1) * info.height / 8) - top;
    const { data: cell, info: ci } = await sharp(clean).extract({ left, top, width, height })
      .raw().toBuffer({ resolveWithObject: true });
    // Retain largest connected foreground component; disconnected color-key specks
    // are not sprite detail. No rotation, mirroring or fabricated motion.
    const visited = new Uint8Array(width * height);
    let largest = [];
    for (let p = 0; p < visited.length; p++) {
      if (visited[p] || cell[p * 4 + 3] === 0) continue;
      const queue = [p]; visited[p] = 1;
      for (let n = 0; n < queue.length; n++) {
        const q = queue[n], x = q % width, y = Math.floor(q / width);
        for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (!visited[next] && cell[next * 4 + 3]) { visited[next] = 1; queue.push(next); }
        }
      }
      if (queue.length > largest.length) largest = queue;
    }
    if (largest.length < 3000) throw new Error(`Empty or corrupted ${direction}/${col}`);
    const keep = new Set(largest);
    for (let p = 0; p < visited.length; p++) if (!keep.has(p)) cell[p * 4 + 3] = 0;
    const image = await sharp(cell, { raw: ci }).resize(size, size, { fit: 'fill' }).png().toBuffer();
    const name = frameName('walk', 'body', direction, col);
    const x = col * stride + padding, y = row * stride + padding;
    composites.push({ input: image, left: x, top: y });
    frames[name] = { frame: { x, y, w: size, h: size }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: size, h: size }, sourceSize: { w: size, h: size },
      anchor: { x: 0.5, y: 0.9 } };
    animations[`walk/body/${direction}`].push(name);
  }
}
await sharp({ create: { width: stride * 4, height: stride * 8, channels: 4, background: '#00000000' } })
  .composite(composites).png().toFile(path.join(output, 'walk-body.png'));
await writeFile(path.join(output, 'walk-body.json'), JSON.stringify({ frames, animations, meta: {
  app: 'arena-animation-pipeline', version: '1', image: 'walk-body.png', format: 'RGBA8888',
  size: { w: stride * 4, h: stride * 8 }, scale: '1',
} }, null, 2) + '\n');
const coverage = [];
for (const [action, settings] of Object.entries(modules)) for (const layer of layers) for (const direction of directions) {
  const produced = action === 'walk' && layer === 'body';
  coverage.push({ action, layer, direction, expectedFrames: settings.frames,
    status: produced ? 'prototype' : 'missing', frames: produced ? animations[`walk/body/${direction}`] : [],
    atlas: produced ? 'walk-body.json' : null, releaseApproved: false });
}
await writeFile(path.join(output, 'coverage.json'), JSON.stringify({
  schemaVersion: 1, contentVersion: 'arena-animation-2026-10-28.1',
  generatedOn: '2026-10-28', source: { path: 'arena/art/source/walk-body-eight-directions.png',
    sha256: createHash('sha256').update(bytes).digest('hex'), generator: 'GPT Image 2 via proxy-imagegen' },
  cell: [size, size], anchor: [0.5, 0.9], padding, directions, layers, modules,
  directionMeaning: { S: 'toward camera', SW: 'toward camera left', W: 'left profile',
    NW: 'away camera left', N: 'away camera', NE: 'away camera right', E: 'right profile', SE: 'toward camera right' },
  defaultLayerOrder: ['weapon-back', 'hair-back', 'body', 'outfit', 'hair-front', 'weapon-front'],
  releaseReady: false, runtimePolicy: 'prototype-preview-only; missing layers never count as animation coverage',
  review: { directionViews: 'Eight distinct source views visually inspected; NW/NE passing poses drift toward N.',
    gait: 'Four authored poses per direction, cadence/foot-sliding needs review.',
    proportion: 'Source is approximately 2.5–2.8 heads; exact 3-head normalization pending.',
    cleanup: 'Chroma specks removed; connected pale edge halos still need manual cleanup.',
    alignment: 'Shared cell anchor provisional; attachment and occlusion tracks not authored.',
    paperDoll: 'Body only. Animated outfits, hairstyles and staff missing; no compatibility claim.' },
  coverage,
}, null, 2) + '\n');
console.log(`Packed ${Object.keys(frames).length} prototype frames; 0 release-approved combinations.`);
