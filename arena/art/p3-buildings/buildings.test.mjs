import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import{readFile}from'node:fs/promises';
const out=new URL('assets/',import.meta.url);
const m=JSON.parse(await readFile(new URL('manifest.json',out),'utf8'));
test('two ground-registered upper modules preserve runtime scale and alpha',async()=>{
 assert.equal(Object.keys(m.assets).length,2);
 for(const a of Object.values(m.assets)){
  assert.equal(a.renderScale,1);assert.equal(a.releaseApproved,false);assert.equal(a.decorationOccupation.collision,false);
  assert.deepEqual(a.anchor,a.pivot.map((n,i)=>n/a.canvas[i]));
  const{data,info}=await sharp(new URL(a.image,out).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height],a.canvas);
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x===0||y===0||x===info.width-1||y===info.height-1)assert.equal(data[(y*info.width+x)*4+3],0);
 }
});
test('muzzle/hit and receiving anchors roundtrip through the unified projection',()=>{
 for(const a of Object.values(m.assets))for(const p of Object.values(a.attachments)){
  const[x,y,z]=p.worldOffset;assert.ok(Math.abs(64*(x-y)-p.offsetScreen[0])<1e-8);
  assert.ok(Math.abs(32*(x+y)-78.3837*z-p.offsetScreen[1])<1e-8);
 }
 assert.ok(m.assets['tower-upper'].attachments.muzzle.worldOffset[2]>1);
 assert.deepEqual(m.assets['warehouse-upper'].localBuildOffset,[1.5,-1]);
 assert.deepEqual(m.assets['tower-upper'].localBuildOffset,[1.5,1]);
});
