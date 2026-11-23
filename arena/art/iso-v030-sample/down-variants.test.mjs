import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('grounded variants preserve independent source and explicit larger-canvas proposal',async()=>{
  const root=new URL('./variants-down/',import.meta.url);
  const r=JSON.parse(await readFile(new URL('registration.json',root),'utf8'));
  assert.equal(r.releaseApproved,false);
  assert.deepEqual(r.canvas,[256,256]);assert.deepEqual(r.groundPivot,[128,204.8]);
  assert.equal(r.renderScale,1);
  for(const d of Object.values(r.directions)){
    assert.deepEqual(d.parts.map(p=>p.id),['torso','head']);
    assert.ok(d.pending.includes('arms and grounded legs'));
    for(const p of d.parts){
      assert.equal(p.originalUprightSourceReused,false);
      const {data,info}=await sharp(new URL(p.image,root).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(info.width,256);assert.equal(info.height,256);
      for(let x=0;x<256;x++)for(const y of [0,255])assert.ok(data[(y*256+x)*4+3]<=8,'vertical canvas clipping');
      for(let y=0;y<256;y++)for(const x of [0,255])assert.ok(data[(y*256+x)*4+3]<=8,'horizontal canvas clipping');
    }
  }
});
