import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { digest } from './idle-pipeline.mjs';

const root=new URL('../client/public/assets/tiles/',import.meta.url);
test('isometric floors share exact 2:1 alpha support and identical seam texels',async()=>{
  const names=['floor-stone','floor-worn','floor-inlay','floor-cracked'],images=[];
  for(const name of names) {
    const {data,info}=await sharp(await readFile(new URL(`${name}.png`,root))).raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,128);assert.equal(info.height,64);images.push(data);
    for(let y=0;y<64;y++)for(let x=0;x<128;x++) {
      const d=Math.abs(x+.5-64)/64+Math.abs(y+.5-32)/32;
      assert.equal(data[(y*128+x)*4+3],d<=1?255:0);
    }
  }
  for(let y=0;y<64;y++)for(let x=0;x<128;x++) {
    const d=Math.abs(x+.5-64)/64+Math.abs(y+.5-32)/32,p=(y*128+x)*4;
    if(d>.92&&d<=1)for(const image of images.slice(1))assert.deepEqual(image.subarray(p,p+4),images[0].subarray(p,p+4));
  }
});
test('tile manifest separates ground geometry from tall sprite size and records reproducible sources',async()=>{
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
  assert.deepEqual(manifest.tileSize,[128,64]);assert.equal(manifest.walkableZ,0);
  assert.equal(Object.keys(manifest.assets).length,8);
  for(const asset of Object.values(manifest.assets)) {
    const meta=await sharp(await readFile(new URL(asset.image,root))).metadata();
    assert.deepEqual(asset.footprint,[1,1]);assert.equal(asset.releaseApproved,false);
    assert.deepEqual(asset.pivot,asset.kind==='floor'?[64,32]:[64,160]);
    assert.equal(meta.height,asset.kind==='floor'?64:192);
  }
  for(const source of manifest.sources) {
    const bytes=await readFile(new URL(`../../${source.source}`,import.meta.url));
    assert.equal(digest(bytes),source.sourceSha256);
  }
});
