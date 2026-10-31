import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(root, '../client/public/assets');
await mkdir(output, { recursive: true });
const source = path.join(root, 'source/doll-sheet.png');
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== 1536 || info.height !== 1024) throw new Error('Source layout changed; review crop coordinates.');
// The model returned alpha instead of the requested magenta. Remove its
// low-alpha ambient halos; retain antialiased silhouette edges.
for (let i = 0; i < data.length; i += 4) {
  const magenta = data[i] > 180 && data[i + 2] > 180 && data[i + 1] < 100;
  data[i + 3] = magenta ? 0 : Math.round(Math.max(0, (data[i + 3] - 40) / 214) * 255);
}
const cleaned = await sharp(data, { raw: info }).png().toBuffer();
const crop = async (left, top, width, height, w, h) =>
  sharp(cleaned).extract({ left, top, width, height }).resize(w, h, { fit: 'fill' }).png().toBuffer();
const blank = () => sharp({ create: { width: 384, height: 384, channels: 4, background: '#00000000' } });
// Head height 120px + body height 240px: explicitly normalize the doll to
// three heads, rather than inheriting the generated 2.4-head concept.
const layers = {
  body: await blank().composite([
    { input: await crop(112, 225, 265, 275, 212, 240), left: 86, top: 134 },
    { input: await crop(132, 23, 222, 202, 132, 120), left: 126, top: 14 },
  ]).png().toBuffer(),
  'outfit-scholar': await blank().composite([
    { input: await crop(601, 177, 334, 285, 230, 195), left: 77, top: 132 },
  ]).png().toBuffer(),
  'outfit-warden': await blank().composite([
    { input: await crop(1117, 161, 326, 303, 230, 202), left: 77, top: 130 },
  ]).png().toBuffer(),
  'hair-ivory': await blank().composite([
    { input: await crop(101, 564, 302, 263, 158, 135), left: 113, top: 10 },
  ]).png().toBuffer(),
  'hair-midnight': await blank().composite([
    { input: await crop(612, 558, 299, 269, 158, 135), left: 113, top: 10 },
  ]).png().toBuffer(),
  'weapon-staff': await blank().composite([
    { input: await crop(1321, 543, 137, 451, 82, 280), left: 263, top: 88 },
  ]).png().toBuffer(),
};
const frames = {};
const composites = [];
const stride = 388;
for (const [i, [name, input]] of Object.entries(layers).entries()) {
  const x = (i % 3) * stride + 2;
  const y = Math.floor(i / 3) * stride + 2;
  composites.push({ input, left: x, top: y });
  frames[name] = { frame: { x, y, w: 384, h: 384 }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: 384, h: 384 }, sourceSize: { w: 384, h: 384 } };
}
await sharp({ create: { width: stride * 3, height: stride * 2, channels: 4, background: '#00000000' } })
  .composite(composites).png().toFile(path.join(output, 'doll-atlas.png'));
await writeFile(path.join(output, 'doll-atlas.json'), JSON.stringify({ frames,
  meta: { app: 'arena-art-pipeline', version: '1', image: 'doll-atlas.png',
    format: 'RGBA8888', size: { w: stride * 3, h: stride * 2 }, scale: '1' } }, null, 2) + '\n');
await sharp(path.join(root, 'source/library-map.png')).png().toFile(path.join(output, 'library-map.png'));
const sources = [];
for (const name of ['doll-sheet.png', 'library-map.png']) {
  const bytes = await readFile(path.join(root, 'source', name));
  sources.push({ path: `source/${name}`, sha256: createHash('sha256').update(bytes).digest('hex'),
    generator: 'GPT Image 2 via proxy-imagegen', generatedOn: '2026-10-27' });
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
  contentVersion: 'arena-art-2026-10-27.1', sources, frameSize: [384, 384],
  padding: 2, layers: Object.keys(layers), anchor: [0.5, 1],
  notes: 'AI-generated source; alpha cleanup and authored alignment. Cosmetics only. Release rights review pending.',
}, null, 2) + '\n');
await blank().composite([
  { input: layers.body }, { input: layers['outfit-scholar'] },
  { input: layers['hair-midnight'] }, { input: layers['weapon-staff'] },
]).png().toFile(path.join(root, 'doll-preview.png'));
console.log(`Packed ${Object.keys(frames).length} aligned RGBA layers → ${output}`);
