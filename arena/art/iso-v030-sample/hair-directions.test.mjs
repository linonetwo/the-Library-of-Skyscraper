import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('six additional headings have two independently sourced hair styles on the shared bald head',async()=>{
  const root=new URL('./equipment-hair-additional/',import.meta.url);
  const r=JSON.parse(await readFile(new URL('attachments.json',root),'utf8'));
  assert.equal(r.releaseApproved,false);
  assert.deepEqual(Object.keys(r.directions).sort(),['E','N','NW','S','SE','W']);
  for(const d of Object.values(r.directions)){
    assert.equal(d.length,4);
    for(const p of d){
      assert.equal(p.joint,'neck');
      assert.deepEqual(p.size,[192,192]);
      const {data,info}=await sharp(new URL(p.image,root).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(info.width,192);
      for(let y=105;y<192;y++)for(let x=0;x<192;x++)assert.ok(data[(y*192+x)*4+3]<=32,'hair contains body pixels');
    }
  }
});
