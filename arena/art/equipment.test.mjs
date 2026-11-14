import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { digest, packEquipment } from './equipment-pipeline.mjs';
import { directions, frameName } from './animation-spec.mjs';

// Synthetic fixtures only exercise rejection/packing, never enter game assets.
async function fixture({ duplicate = false, head = false, noAlpha = false } = {}) {
  const width = 32 * 32, height = 32, pixels = Buffer.alloc(width * height * 4);
  for (let frame = 0; frame < 32; frame++) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const p = (y * width + frame * 32 + x) * 4;
    pixels[p] = duplicate ? 30 : 30 + frame * 3;
    pixels[p + 1] = 90; pixels[p + 2] = 120; pixels[p + 3] = 255;
  }
  let image = sharp(pixels, { raw: { width, height, channels: 4 } });
  if (noAlpha) image = image.removeAlpha();
  const sourceBytes = await image.png().toBuffer(), promptBytes = Buffer.from('Synthetic test fixture, not generated artwork');
  const recipe = { schemaVersion: 1, action: 'walk', layer: 'outfit-scholar',
    sourceSha256: digest(sourceBytes), promptSha256: digest(promptBytes), sourceSize: [width, height],
    frames: directions.flatMap((direction, row) => Array.from({ length: 4 }, (_, col) => ({
      name: frameName('walk', 'outfit-scholar', direction, col),
      crop: { x: (row * 4 + col) * 32, y: 0, w: 32, h: 32 },
      placement: { x: 80, y: head ? 20 : 85, w: 32, h: 32 },
    }))) };
  return { recipe, sourceBytes, promptBytes };
}
test('equipment atlas uses shared body cell/anchor, directional keys and never grants approval', async () => {
  const result = await packEquipment(await fixture());
  assert.equal(Object.keys(result.atlas.frames).length, 32);
  assert.deepEqual(result.atlas.frames['walk/outfit-scholar/N/00'].anchor, { x: 0.5, y: 0.9 });
  for (const direction of directions) assert.equal(result.atlas.animations[`walk/outfit-scholar/${direction}`].length, 4);
  const meta = await sharp(result.image).metadata();
  assert.equal(meta.width, 784); assert.equal(meta.height, 1568); assert(meta.hasAlpha);
  assert.equal(result.provenance.releaseApproved, false);
  assert.equal(result.provenance.atlasPngSha256, digest(result.image));
});
test('clothing pipeline rejects opaque head, repeated stills and absent transparency', async () => {
  await assert.rejects(packEquipment(await fixture({ head: true })), /transparency violation/);
  await assert.rejects(packEquipment(await fixture({ duplicate: true })), /Repeated still/);
  await assert.rejects(packEquipment(await fixture({ noAlpha: true })), /alpha channel/);
});
test('clothing pipeline rejects missing directions, changed source and invalid crop', async () => {
  const missing = await fixture(); missing.recipe.frames.pop();
  await assert.rejects(packEquipment(missing), /Exactly 32/);
  const changed = await fixture(); changed.recipe.sourceSha256 = 'invalid';
  await assert.rejects(packEquipment(changed), /hash changed/);
  const crop = await fixture(); crop.recipe.frames[0].crop.x = -1;
  await assert.rejects(packEquipment(crop), /Invalid crop/);
});
