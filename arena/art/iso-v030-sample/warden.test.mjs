import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('warden has independent coat and two articulated sleeves with front coverage',async()=>{
  const root=new URL('./equipment-warden/',import.meta.url);
  const r=JSON.parse(await readFile(new URL('attachments.json',root),'utf8'));
  assert.equal(r.releaseApproved,false);assert.equal(r.renderScale,1);
  for(const direction of ['NE','SW']) {
    const p=r.directions[direction],near=direction==='NE'?'right':'left';
    assert.equal(p.length,5);
    assert.equal(p.find(a=>a.id==='coat').joint,'pelvis');
    for(const a of p) {
      const m=await sharp(new URL(a.image,root).pathname).metadata();
      assert.equal(m.width,192);assert.equal(m.height,192);
      if(a.id.startsWith(near))assert.equal(a.layer,'outfit-warden-front');
      else assert.equal(a.layer,'outfit-warden');
      if(a.id.includes('sleeve')){
        assert.ok(a.explicitClothingFit.axisScale>0);
        assert.ok(a.joint.endsWith('Shoulder')||a.joint.endsWith('Elbow'));
      }
    }
  }
});
