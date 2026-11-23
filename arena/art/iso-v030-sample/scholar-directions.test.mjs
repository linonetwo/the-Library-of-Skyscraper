import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('six independent scholar directions retain registration and transparent neckline',async()=>{
 const data=JSON.parse(await readFile(new URL('equipment-scholar-additional/attachments.json',import.meta.url)));
 assert.deepEqual(Object.keys(data.directions).sort(),['E','N','NW','S','SE','W']);
 assert.equal(data.renderScale,1);
 for(const parts of Object.values(data.directions)){
  assert.equal(parts.length,1);
  assert.equal(parts[0].joint,'pelvis');
  assert.equal(parts[0].layer,'outfit-scholar');
  const image=await sharp(new URL(`equipment-scholar-additional/${parts[0].image}`,import.meta.url).pathname).metadata();
  assert.deepEqual([image.width,image.height],[192,192]);
  assert.ok(image.hasAlpha);
  assert.ok(parts[0].neckHole.length===4);
 }
});
