import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
const out=new URL('assets/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',out),'utf8'));
test('five independent assets are correctly anchored prototypes',async()=>{
  assert.equal(Object.keys(manifest.assets).length,5);
  for(const a of Object.values(manifest.assets)){
    assert.equal(a.status,'prototype');assert.equal(a.releaseApproved,false);assert.equal(a.renderScale,1);
    assert.ok(a.heightMeters<=.35);assert.equal(a.decorationOccupation.collision,false);
    assert.deepEqual(a.anchor,a.pivot.map((n,i)=>n/a.canvas[i]));
    const {data,info}=await sharp(new URL(a.image,out).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual([info.width,info.height],a.canvas);
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x===0||y===0||x===info.width-1||y===info.height-1)assert.equal(data[(y*info.width+x)*4+3],0,`${a.image} transparent outer margin`);
    assert.ok(data.some((v,i)=>i%4===3&&v===255),`${a.image} opaque painted interior`);
  }
});
test('walkable markings retain exact ground dimensions and never claim navigation',()=>{
  assert.deepEqual(manifest.assets['target-inlay'].footprint,[2,2]);
  for(const id of ['threshold-u','threshold-v','target-inlay']){
    assert.equal(manifest.assets[id].walkable,true);assert.equal(manifest.assets[id].heightMeters,0);
    assert.equal(manifest.assets[id].layer,'floor-before-props');
  }
  assert.equal(manifest.assets['threshold-u'].clearWidthMeters,2);
  assert.equal(manifest.review.clientIntegrated,false);
});
