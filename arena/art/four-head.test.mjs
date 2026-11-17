import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { extractSourceSprites } from './source-sprites.mjs';
import { keepPixel } from './idle-pipeline.mjs';
import { normalizeNeutral } from './four-head-registration.mjs';
import { bounds } from './motion-registration.mjs';

test('neutral source is registered to four-head anatomy with a single stable ground pivot in all eight views',async()=>{
  const bytes=await readFile(new URL('source/four-head-neutral.png',import.meta.url));
  const {sprites}=await extractSourceSprites(bytes,{columns:2,rows:4,keepPixel});
  assert.equal(sprites.length,8);
  for(const sprite of sprites) {
    const {image,recipe}=await normalizeNeutral(sprite),raw=await sharp(image).raw().toBuffer();
    const body=bounds(raw),head=bounds(raw,0,53);
    assert.equal(body.bottom,172);assert.ok(body.top>=12&&body.top<=13);
    assert.ok(Math.abs(body.height/head.height-4)<.1);
    assert.ok(head.width>=38&&head.width<=40);assert.deepEqual(recipe.groundPivot,[96,172.8]);
    assert.equal(recipe.skeleton.sole-recipe.skeleton.crown,4*(recipe.skeleton.chin-recipe.skeleton.crown));
    for(let p=0;p<192;p++) {
      assert.equal(raw[p*4+3],0);assert.equal(raw[((191*192)+p)*4+3],0);
      assert.equal(raw[(p*192)*4+3],0);assert.equal(raw[(p*192+191)*4+3],0);
    }
  }
});
