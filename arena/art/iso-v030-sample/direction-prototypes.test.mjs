import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const base=new URL('./direction-prototypes/',import.meta.url);
test('six independent directions retain source hashes and isotropic component registration',async()=>{
  const r=JSON.parse(await readFile(new URL('registration.json',base),'utf8'));
  assert.deepEqual(Object.keys(r.directions).sort(),['E','N','NW','S','SE','W']);
  for(const [direction,d]of Object.entries(r.directions)) {
    assert.equal(d.releaseApproved,false); assert.equal(d.cameraApproved,false);
    assert.deepEqual(d.groundPivot,[96,172.8]);
    const bytes=await readFile(new URL(`../source/${d.source}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),d.sourceSha256);
    assert.deepEqual(d.parts.map(p=>p.id),['body','head']);
    for(const p of d.parts)assert.equal(p.scaleMode,'isotropic');
    const {data,info}=await sharp(new URL(`${direction}.png`,base).pathname).raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,192);assert.equal(info.height,192);
    let ymin=192,ymax=0,xmin=192,xmax=0;
    for(let y=0;y<192;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>32){
      ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);
    }
    assert.ok(ymin>=38&&ymin<=44,`${direction} crown ${ymin}`);
    assert.ok(ymax>=170&&ymax<=176,`${direction} sole ${ymax}`);
    assert.ok(xmin>0&&xmax<191,`${direction} clipping`);
  }
});
