import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('six staff directions preserve true wrist grip and complementary empty hand',async()=>{
 const r=JSON.parse(await readFile(new URL('equipment-staff-additional/attachments.json',import.meta.url)));
 assert.equal(r.newGenerationRequests,0);
 assert.equal(Object.keys(r.directions).length,6);
 for(const[heading,d]of Object.entries(r.directions)){
  assert.ok(d.naturalHandExclusiveWithGrip);
  assert.deepEqual(d.replaceIds,['right-forearm-hand']);
  for(const a of d.attachments){
   assert.equal(a.joint,a.id==='right-forearm'?'rightElbow':'rightWrist');
   const buffer=await readFile(new URL(`equipment-staff-additional/${a.image}`,import.meta.url));
   assert.ok((await sharp(buffer).raw().toBuffer()).length>0);
  }
  const hand=d.attachments.find(a=>a.id==='right-hand-grip'),staff=d.attachments.find(a=>a.id==='staff');
  assert.deepEqual(hand.gripOffset,staff.gripOffset,heading);
  assert.equal(d.attachments.find(a=>a.id==='right-natural-hand').absoluteAngleFrom,'rightElbow');
 }
});
