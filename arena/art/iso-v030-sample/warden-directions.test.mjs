import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('six warden directions independently register coat and joint sleeves',async()=>{
 const report=JSON.parse(await readFile(new URL('equipment-warden-additional/attachments.json',import.meta.url)));
 assert.deepEqual(Object.keys(report.directions).sort(),['E','N','NW','S','SE','W']);
 for(const[heading,parts]of Object.entries(report.directions)){
  assert.equal(parts.length,5);
  assert.equal(parts.find(a=>a.id==='coat').joint,'pelvis');
  const fronts=parts.filter(a=>a.layer==='outfit-warden-front');
  assert.equal(fronts.length,heading==='N'?0:heading==='S'?4:2);
  for(const part of parts){
   const{data,info}=await sharp(new URL(`equipment-warden-additional/${part.image}`,import.meta.url).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.deepEqual([info.width,info.height],[192,192]);
   assert.ok(data.some((v,i)=>i%4===3&&v>128),`${heading}/${part.id} visible`);
  }
 }
});
