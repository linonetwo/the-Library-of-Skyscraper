import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
const out=new URL('../../client/public/assets/iso-v030-sample/',import.meta.url);
const load=async file=>JSON.parse(await readFile(new URL(file,out),'utf8'));
test('camera source stays prototype and world scale is independent of canvas size',async()=>{
  const meta=await load('registration.json');
  assert.equal(meta.walkApproved,false);assert.equal(meta.releaseApproved,false);
  assert.deepEqual(meta.cell,[192,192]);
  assert.equal(meta.camera.elevationDegrees,30);
  for(const frame of meta.frames) {
    const height=frame.groundPivot[1]-frame.crown[1];
    assert.ok(height>128&&height<138,`crown-to-ground ${height}`);
    assert.equal(frame.placement[2]/384,frame.placement[3]/512,'must scale uniformly');
  }
});
test('NE/SW atlases expose explicit sample keys, no fabricated idle/walk coverage',async()=>{
  for(const layer of ['body','body-front','outfit-scholar','hair-ivory-front','hair-ivory-back']) {
    const atlas=await load(`${layer}.json`);
    assert.deepEqual(Object.keys(atlas.frames),[`sample/${layer}/NE/00`,`sample/${layer}/SW/00`]);
    const info=await sharp(await readFile(new URL(`${layer}.png`,out))).metadata();
    assert.equal(info.width,392);assert.equal(info.height,196);assert.equal(info.hasAlpha,true);
  }
});
test('registered anatomy is fully inside cell with no opaque boundary cropping',async()=>{
  for(const layer of ['body','body-front']) {
    const {data,info}=await sharp(await readFile(new URL(`${layer}.png`,out))).raw().toBuffer({resolveWithObject:true});
    for(const offset of [2,198])for(let y=0;y<192;y++)for(let x=0;x<192;x++) {
      if(x>0&&x<191&&y>0&&y<191)continue;
      assert.ok(data[((y+2)*info.width+offset+x)*4+3]<128,`${layer} clipped at ${x},${y}`);
    }
  }
});
test('two independent direction rigs have all limb attachments and no double scale',async()=>{
  const rig=JSON.parse(await readFile(new URL('attachments/rig.json',import.meta.url),'utf8'));
  assert.equal(rig.renderScale,1);assert.equal(rig.walkApproved,false);
  for(const direction of ['NE','SW']) {
    assert.equal(rig.directions[direction].attachments.length,12);
    for(const attachment of rig.directions[direction].attachments) {
      assert.equal(attachment.scale,undefined);
      assert.equal(attachment.sourceScale,.328125);
      const image=await sharp(await readFile(new URL(`attachments/${attachment.image}`,import.meta.url))).metadata();
      assert.deepEqual([image.width,image.height],attachment.size);
    }
  }
});
test('new complete-limb source restores equal left/right chains without stretching old parts',async()=>{
  const rig=JSON.parse(await readFile(new URL('attachments-complete/rig.json',import.meta.url),'utf8'));
  assert.equal(rig.renderScale,1);assert.equal(rig.walkApproved,false);
  assert.match(rig.source,/complete-limbs\.png$/);
  for(const direction of ['NE','SW']) {
    const d=rig.directions[direction];
    assert.equal(d.attachments.length,15);
    for(const bone of ['thigh','shin']) {
      assert.ok(Math.abs(d.legLengthReport.left[bone]-d.legLengthReport.right[bone])<.01);
      assert.ok(d.legLengthReport.left[bone]>22&&d.legLengthReport.left[bone]<27);
    }
    for(const a of d.attachments.filter(a=>a.sourceSet==='complete-limbs'))
      assert.equal(a.scale,undefined,'sourceScale is provenance, not another transform');
  }
});
