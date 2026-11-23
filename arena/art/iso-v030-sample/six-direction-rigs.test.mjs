import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('six neutral rigs retain twelve real parts and common leg units',async()=>{
  const root=new URL('./attachments-six-directions/',import.meta.url);
  const r=JSON.parse(await readFile(new URL('rig.json',root),'utf8'));
  assert.equal(r.releaseApproved,false);assert.equal(r.walkApproved,false);
  for(const [direction,d]of Object.entries(r.directions)) {
    assert.equal(d.attachments.length,12,direction);
    assert.equal(new Set(d.attachments.map(p=>p.id)).size,12);
    for(const side of ['left','right']){
      assert.ok(Math.abs(Math.hypot(...d.joints[side+'Knee'].restOffset)-24.98637)<1e-8);
      assert.ok(Math.abs(Math.hypot(...d.joints[side+'Ankle'].restOffset)-23.98948)<1e-8);
      assert.equal(d.feet[side].contactVerified,false);
    }
    for(const p of d.attachments){
      assert.ok(d.joints[p.joint]);
      assert.ok(p.pivot.every(Number.isFinite));
      const m=await sharp(new URL(p.image,root).pathname).metadata();
      assert.deepEqual([m.width,m.height],p.size);
      if(p.widthFit!==undefined&&p.widthFit!==1)assert.equal(p.thicknessFitReviewPending,true);
    }
  }
});
