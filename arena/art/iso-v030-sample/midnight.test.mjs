import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('midnight is independent hair-only front/back attachments on shared neck',async()=>{
  const root=new URL('./equipment-midnight/',import.meta.url);
  const registration=JSON.parse(await readFile(new URL('attachments.json',root),'utf8'));
  assert.equal(registration.renderScale,1);
  for(const direction of ['NE','SW'])for(const part of registration.directions[direction]){
    assert.equal(part.joint,'neck');
    assert.match(part.layer,/^hair-midnight-(front|back)$/);
    const {data,info}=await sharp(new URL(part.image,root).pathname).raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,192);assert.equal(info.height,192);
    let count=0;
    for(let y=0;y<192;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>32){
      count++;assert.ok(y<105,'hair contains body-region pixels');
      assert.ok(x>0&&x<191&&y>0,'hair clipped to canvas edge');
    }
    if(direction==='NE'&&part.layer.endsWith('back'))assert.equal(count,0);
    else assert.ok(count>100);
  }
});
