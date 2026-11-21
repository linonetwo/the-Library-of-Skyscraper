import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
const world=new URL('../../client/public/assets/iso-v030-world/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',world),'utf8'));
test('world sprites use explicit size/pivot and transparent independent files',async()=>{
  assert.equal(manifest.camera.elevation,30);
  for(const [id,a]of Object.entries(manifest.assets)){
    const {data,info}=await sharp(await readFile(new URL(a.image,world))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual([info.width,info.height],a.canvas,id);
    assert.deepEqual(a.anchor,[a.pivot[0]/info.width,a.pivot[1]/info.height]);
    assert.equal(a.releaseApproved,false);
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      if(x>0&&x<info.width-1&&y>0&&y<info.height-1)continue;
      assert.ok(data[(y*info.width+x)*4+3]<128,`${id} opaque canvas clipping`);
    }
  }
});
test('construction foreground/background are complementary source layers',async()=>{
  const files=await Promise.all(['construction-site','construction-site-front','construction-site-back']
    .map(async id=>(await sharp(await readFile(new URL(`${id}.png`,world))).ensureAlpha().raw().toBuffer())));
  for(let p=0;p<files[0].length;p+=4) {
    assert.equal(files[1][p+3]+files[2][p+3],files[0][p+3]);
    assert.ok(files[1][p+3]===0||files[2][p+3]===0);
  }
});
test('cargo attachment and neutral enemy describe incomplete action work',()=>{
  assert.equal(manifest.assets['cargo-bundle'].attachJoint,'pelvis');
  assert.equal(manifest.assets['cargo-bundle'].handPosePending,true);
  for(const d of ['NE','SW'])assert.deepEqual(manifest.assets[`inkguard-${d}`].actionsApproved,[]);
});
