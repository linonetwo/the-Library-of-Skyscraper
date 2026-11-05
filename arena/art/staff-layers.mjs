import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { art, output } from './registered-layer.mjs';
import { staffDepth } from './staff-registration.mjs';

export async function splitStaffDepth(image, atlas) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  const split = {};
  for (const depth of ['back', 'front']) {
    const pixels = Buffer.from(data);
    for (let y = 0; y < info.height; y++) {
      if (staffDepth[Math.floor(y / 196)] !== depth) pixels.fill(0, y * info.width * 4, (y + 1) * info.width * 4);
    }
    const layer = `weapon-staff-${depth}`;
    const layerAtlas = JSON.parse(JSON.stringify(atlas).replaceAll('weapon-staff', layer));
    split[depth] = await sharp(pixels, { raw: info }).png().toBuffer();
    await writeFile(new URL(`walk-${layer}.png`, output), split[depth]);
    await writeFile(new URL(`walk-${layer}.json`, output), JSON.stringify(layerAtlas, null, 2) + '\n');
  }
  return split;
}

export async function createStaffPreview(split) {
  for (const outfit of ['scholar', 'warden']) {
    const names = ['walk-body.png', `walk-outfit-${outfit}.png`, 'walk-body-front.png', 'walk-hair-ivory.png'];
    const [body, clothes, hands, hair] = await Promise.all(names.map(name => readFile(new URL(name, output))));
    await sharp(split.back).composite([
      { input: body }, { input: clothes }, { input: split.front }, { input: hands }, { input: hair },
    ]).png().toFile(new URL(`walk-${outfit}-staff-preview.png`, art).pathname);
  }
}
