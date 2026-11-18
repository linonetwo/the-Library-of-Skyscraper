import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { extractSourceSprites } from './source-sprites.mjs';
import { keepPixel } from './idle-pipeline.mjs';
import { normalizeNeutral } from './four-head-registration.mjs';
import { bounds } from './motion-registration.mjs';

test('neutral source is registered to four-head anatomy with a single stable ground pivot in all eight views',async()=>{
  const bytes=await readFile(new URL('source/four-head-neutral.png',import.meta.url));
  const {sprites}=await extractSourceSprites(bytes,{columns:2,rows:4,keepPixel});
  assert.equal(sprites.length,8);
  for(const sprite of sprites) {
    const {image,recipe}=await normalizeNeutral(sprite),raw=await sharp(image).raw().toBuffer();
    const body=bounds(raw),head=bounds(raw,0,53);
    assert.equal(body.bottom,172);assert.ok(body.top>=12&&body.top<=13);
    assert.ok(Math.abs(body.height/head.height-4)<.1);
    assert.ok(head.width>=38&&head.width<=40);assert.deepEqual(recipe.groundPivot,[96,172.8]);
    assert.equal(recipe.skeleton.sole-recipe.skeleton.crown,4*(recipe.skeleton.chin-recipe.skeleton.crown));
    for(let p=0;p<192;p++) {
      assert.equal(raw[p*4+3],0);assert.equal(raw[((191*192)+p)*4+3],0);
      assert.equal(raw[(p*192)*4+3],0);assert.equal(raw[(p*192+191)*4+3],0);
    }
  }
});

test('walk correction recipes trace selected limb sources without switching the E anatomical grip',async()=>{
  const root=new URL('../client/public/assets/animation/',import.meta.url);
  const registration=JSON.parse(await readFile(new URL('walk-registration.json',root)));
  const staff=JSON.parse(await readFile(new URL('walk-weapon-staff.attachments.json',root)));
  for(let row=0;row<8;row++)for(const col of [2,3]) {
    const frame=registration.frames[row*4+col];
    assert.notEqual(frame.correction,'original');
    if(row===4)assert.match(frame.correction,/neck-down limb reflection/);
    else assert.deepEqual(frame.headSource.retainedTargetRows,[0,56]);
  }
  assert.equal(registration.frames[5*4+3].limbRepair.direction,'NE');
  assert.equal(registration.frames[7*4+2].limbRepair.direction,'SE');
  assert.deepEqual(staff.attachments[6*4+2].sourceHandCenter,[68,250]);
  assert.deepEqual(staff.attachments[6*4+2].grip,{
    x:registration.frames[6*4+2].attachments.rightHand[0],y:registration.frames[6*4+2].attachments.rightHand[1]});
});

test('side passing corrections retain source joints and low knee while avoiding atlas scanline dilation',async()=>{
  const registration=JSON.parse(await readFile(new URL('../client/public/assets/animation/walk-registration.json',import.meta.url)));
  for(const [row,direction] of [[2,'W'],[6,'E']]) {
    const contact=registration.frames[row*4+2],passing=registration.frames[row*4+3];
    assert.equal(contact.balance.legWidthScale,1);
    assert.equal(contact.balance.contactSourceWidthScale,1.15);
    assert.equal(passing.balance.legWidthScale,1);
    assert.equal(passing.sidePassing.direction,direction);
    assert.equal(passing.sidePassing.module,'four-head-side-passing.mjs');
    assert.equal(passing.sidePassing.targetJoints[1][1],130);
    assert.equal(passing.sidePassing.supportPhase,'01');
    assert.match(passing.sidePassing.supportSource,/four-head-walk-body.png$/);
    assert.equal(passing.sidePassing.sourceJoints.length,3);
    assert.equal(passing.sidePassing.status,'approved');
    assert.equal(passing.sidePassing.approvalRecord,'arena/art/approval-v0.2.0.json');
  }
});
