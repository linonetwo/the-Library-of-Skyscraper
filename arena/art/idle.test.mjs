import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { directions, layers, frameName } from './animation-spec.mjs';
import { output, digest } from './idle-pipeline.mjs';

const json = async name => JSON.parse(await readFile(new URL(name,output),'utf8'));
async function cell(layer,row,col) {
  return sharp(await readFile(new URL(`idle-${layer}.png`,output)))
    .extract({left:col*196+2,top:row*196+2,width:192,height:192}).raw().toBuffer();
}
test('idle covers all six logical layers, eight directions, four real distinct frames with provenance',async()=>{
  const coverage=await json('coverage.json');
  assert.equal(coverage.coverage.filter(e=>e.action==='idle'&&e.status==='prototype').length,48);
  for (const layer of layers) {
    const atlas=await json(`idle-${layer}.json`), provenance=await json(`idle-${layer}.provenance.json`);
    assert.equal(Object.keys(atlas.frames).length,32);
    assert.equal(provenance.releaseApproved,false);
    assert.equal(provenance.atlasPngSha256,digest(await readFile(new URL(atlas.meta.image,output))));
    const source=await readFile(new URL(provenance.source,new URL('../../',import.meta.url)));
    assert.equal(provenance.sourceSha256,digest(source));
    for (let row=0;row<8;row++) {
      const hashes=new Set();
      for(let col=0;col<4;col++) {
        assert(atlas.frames[frameName('idle',layer,directions[row],col)]);
        const pixels=await cell(layer,row,col); hashes.add(digest(pixels));
        assert(pixels.some((v,i)=>i%4===3&&v>128));
        for(let y=0;y<192;y++) for(let x=0;x<192;x++)
          if(x===0||y===0||x===191||y===191) assert.equal(pixels[(y*192+x)*4+3],0);
      }
      assert.equal(hashes.size,4,`${layer}/${directions[row]} must have four distinct breathing frames`);
    }
  }
});
test('idle feet are locked and dedicated standing body is not a walk-frame substitute',async()=>{
  for(let row=0;row<8;row++){
    const base=await cell('body',row,0);
    for(let col=1;col<4;col++) assert.deepEqual((await cell('body',row,col)).subarray(112*192*4),base.subarray(112*192*4));
  }
  const p=await json('idle-body.provenance.json');
  assert.equal(p.source,'arena/art/source/four-head-neutral.png');
  assert.equal(p.sourceSha256,digest(await readFile(new URL('./source/four-head-neutral.png',import.meta.url))));
});
test('idle hair and weapon front/back masks reconstruct their aggregate pixels',async()=>{
  for(const layer of ['hair-ivory','hair-midnight','weapon-staff']) for(let row=0;row<8;row++)for(let col=0;col<4;col++) {
    const full=await cell(layer,row,col), back=await cell(`${layer}-back`,row,col), front=await cell(`${layer}-front`,row,col);
    for(let p=0;p<full.length;p+=4) {
      assert(!(back[p+3]&&front[p+3]),`${layer} split must not overlap`);
      if(full[p+3]) assert.deepEqual(back[p+3]?back.subarray(p,p+4):front.subarray(p,p+4),full.subarray(p,p+4));
    }
  }
});
test('idle registration records all frames, anchors, durations and staff depth',async()=>{
  const registration=await json('idle-registration.json'), staff=await json('idle-weapon-staff.attachments.json');
  assert.equal(registration.frames.length,32); assert.equal(staff.attachments.length,32);
  assert.deepEqual(registration.anchor,[0.5,0.9]);
  for(const frame of registration.frames) {
    assert.equal(frame.durationMs,250); assert.equal(frame.deformation.lowerBodyFixedFromY,112);
    for(const key of ['crown','neck','hip','leftHand','rightHand']) assert.equal(frame.attachments[key].length,2);
  }
  for(const frame of staff.attachments) assert(['front','back'].includes(frame.depth));
});
