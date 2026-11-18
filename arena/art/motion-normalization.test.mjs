import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { directions, frameName } from './animation-spec.mjs';
import { output, art, digest } from './idle-pipeline.mjs';
import { cellBytes, bounds } from './motion-registration.mjs';

const read=name=>readFile(new URL(name,output)),json=async name=>JSON.parse(await read(name));
test('four-head walk matches reviewed idle anatomy and sole baseline while retaining 32 independent gait poses',async()=>{
  const recipe=await json('walk-registration.json'),body=await read('walk-body.png'),idle=await read('idle-body.png');
  assert.equal(recipe.frames.length,32);
  const hashes=new Set();
  for(const [index,frame]of recipe.frames.entries()) {
    assert(frame.sourcePoseRetained);
    const row=Math.floor(index/4),col=index%4,pixels=await cellBytes(body,row,col);
    const target=bounds(await cellBytes(idle,row,0),0,53),head=bounds(pixels,0,54);
    assert(Math.abs(head.width-target.width)<=2);assert(Math.abs(head.height-target.height)<=2);
    assert.equal(bounds(pixels).bottom,172);
    assert.equal(frame.skeleton.sole-frame.skeleton.crown,4*(frame.skeleton.chin-frame.skeleton.crown));
    assert.deepEqual(frame.groundPivot,[96,172.8]);assert.equal(frame.durationMs,125);
    hashes.add(digest(pixels));assert.notEqual(digest(pixels),digest(await cellBytes(idle,row,0)));
  }
  assert.equal(hashes.size,32);
});
test('both walk costumes use the same authored designs as idle with four independent motion phases',async()=>{
  for(const outfit of ['scholar','warden']) {
    const walk=await json(`walk-outfit-${outfit}.provenance.json`),idle=await json(`idle-outfit-${outfit}.provenance.json`);
    assert.equal(walk.designSource,idle.designSource);
    assert.equal(walk.designSource,'arena/art/source/four-head-outfits.png');
    assert.notEqual(walk.sourceSha256,idle.sourceSha256,'walk has independent generated garment poses');
    assert.equal(walk.source,`arena/art/source/four-head-walk-${outfit}.png`);
    const image=await read(`walk-outfit-${outfit}.png`);
    for(let row=0;row<8;row++) {
      const hashes=new Set();
      for(let col=0;col<4;col++)hashes.add(digest(await cellBytes(image,row,col)));
      assert.equal(hashes.size,4);
    }
  }
});
test('generated grip artwork covers each registered shaft contact in both actions with bounded transparent cells',async()=>{
  const source=await readFile(new URL('source/grip-hands.png',art));
  for(const action of ['idle','walk']) {
    const provenance=await json(`${action}-hand-grip.provenance.json`),atlas=await json(`${action}-hand-grip.json`);
    assert.equal(provenance.sourceSha256,digest(source));assert.equal(provenance.releaseApproved,true);
    assert.equal(provenance.approvalRecord,'arena/art/approval-v0.2.0.json');
    const hand=await read(`${action}-hand-grip.png`),staff=await read(`${action}-weapon-staff.png`);
    assert.equal(provenance.atlasPngSha256,digest(hand));
    const tracks=(await json(`${action}-weapon-staff.attachments.json`)).attachments;
    for(let row=0;row<8;row++)for(let col=0;col<4;col++) {
      assert(atlas.frames[frameName(action,'hand-grip',directions[row],col)]);
      const hp=await cellBytes(hand,row,col),sp=await cellBytes(staff,row,col),b=bounds(hp);
      assert(b.width>=5&&b.width<=22);assert(b.height>=8&&b.height<=22);
      assert(b.left>0&&b.right<191&&b.top>0&&b.bottom<191);
      const {grip}=tracks[row*4+col];let overlap=0;
      for(let y=Math.round(grip.y)-3;y<=Math.round(grip.y)+3;y++)for(let x=Math.round(grip.x)-3;x<=Math.round(grip.x)+3;x++) {
        const p=(y*192+x)*4+3;if(hp[p]>96&&sp[p]>96)overlap++;
      }
      assert(overlap>0,`${action}/${directions[row]}/${col} fingers must cover the shaft`);
    }
  }
});
test('normalized layer and grip registration hashes point to the exact reproducible recipes',async()=>{
  for(const action of ['idle','walk'])for(const layer of action==='idle'?['hand-grip']:
    ['body','body-front','outfit-scholar','outfit-warden','hair-ivory','hair-midnight','weapon-staff','hand-grip']) {
    const p=await json(`${action}-${layer}.provenance.json`);
    const recipe=await readFile(new URL(p.registration,new URL('../../',import.meta.url)));
    assert.equal(p.recipeSha256,digest(recipe));
    assert.equal(JSON.parse(recipe).frames.length,32);
  }
});
