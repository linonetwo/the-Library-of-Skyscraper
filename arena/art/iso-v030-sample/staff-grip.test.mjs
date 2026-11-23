import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('natural and grip hands are exclusive and staff uses the real right wrist',async()=>{
  const root=new URL('./equipment-staff/',import.meta.url);
  const r=JSON.parse(await readFile(new URL('attachments.json',root),'utf8'));
  const rig=JSON.parse(await readFile(new URL('attachments-complete/rig.json',import.meta.url),'utf8'));
  assert.equal(r.newGenerationRequests,0);assert.equal(r.releaseApproved,false);
  for(const direction of ['NE','SW']){
    const d=r.directions[direction],p=d.attachments;
    assert.deepEqual(d.replaceIds,['right-forearm-hand']);
    assert.equal(d.naturalHandExclusiveWithGrip,true);
    for(const id of ['right-hand-grip','staff'])assert.equal(p.find(a=>a.id===id).joint,'rightWrist');
    const a=rig.directions[direction].attachments.find(a=>a.id==='right-forearm-hand');
    const original=await sharp(new URL(`attachments-complete/${a.image}`,import.meta.url).pathname).ensureAlpha().raw().toBuffer();
    const forearm=await sharp(new URL(p.find(a=>a.id==='right-forearm').image,root).pathname).ensureAlpha().raw().toBuffer();
    const natural=await sharp(new URL(p.find(a=>a.id==='right-natural-hand').image,root).pathname).ensureAlpha().raw().toBuffer();
    for(let i=3;i<original.length;i+=4)assert.equal(forearm[i]+natural[i],original[i]);
    const staff=p.find(a=>a.id==='staff'),shaft=d.sourceRegistration.shaft;
    for(let i=0;i<2;i++)assert.ok(Math.abs(
      staff.restTopLeft[i]+shaft[i]*d.staffScale-(d.wristCell[i]+d.gripOffset[i]))<1e-8);
  }
});
