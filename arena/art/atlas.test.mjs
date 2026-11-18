import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { digest } from './idle-pipeline.mjs';
import { dollLayers } from './four-head-idle.mjs';
import { approvedActions, approvedMetadata } from './art-approval.mjs';

const base=new URL('../client/public/assets/',import.meta.url);
const json=async name=>JSON.parse(await readFile(new URL(name,base)));

test('current asset index resolves 28 aligned action atlases and both tile atlases',async()=>{
  const manifest=await json('manifest.json');
  assert.equal(manifest.schemaVersion,2);
  for(const [key,value] of Object.entries(approvedMetadata))assert.equal(manifest[key],value);
  assert.deepEqual(manifest.animation.actions,approvedActions);
  assert.deepEqual(manifest.animation.atlases,
    approvedActions.flatMap(action=>dollLayers.map(layer=>`animation/${action}-${layer}.json`)));
  assert.equal(manifest.animation.compositeFrames,2*8*4*2*2*2);
  assert.equal(manifest.animation.appearanceCombinations,8);
  assert.equal(manifest.tiles.manifest,'tiles/manifest.json');
  assert.deepEqual(manifest.tiles.atlases,['tiles/floors.json','tiles/props.json']);
  await access(new URL(manifest.animation.coverage,base));
  await access(new URL(manifest.tiles.manifest,base));
  for(const name of [...manifest.animation.atlases,...manifest.tiles.atlases]) {
    const atlas=await json(name),image=new URL(atlas.meta.image,new URL(name,base));
    const metadata=await sharp(await readFile(image)).metadata();
    assert.equal(metadata.hasAlpha,true);
    assert.deepEqual(atlas.meta.size,{w:metadata.width,h:metadata.height});
    const animated=name.startsWith('animation/');
    assert.equal(Object.keys(atlas.frames).length,animated?32:4);
    for(const entry of Object.values(atlas.frames)) {
      const {x,y,w,h}=entry.frame;
      assert.equal(entry.rotated,false);assert.equal(entry.trimmed,false);
      assert(x>=2&&y>=2&&x+w+2<=metadata.width&&y+h+2<=metadata.height);
      if(animated) {
        assert.deepEqual(entry.anchor,{x:0.5,y:0.9});
        assert.deepEqual(entry.sourceSize,{w:192,h:192});
      }
    }
  }
  for(const name of ['library-map.png','doll-atlas.png','doll-atlas.json'])
    await assert.rejects(access(new URL(name,base)),{code:'ENOENT'});
});

test('approval pins exactly the 28 animation PNGs, eight independent tiles and two tile atlas PNGs',async()=>{
  const record=JSON.parse(await readFile(new URL('approval-v0.2.0.json',import.meta.url)));
  assert.equal(record.status,'approved');
  assert.equal(record.contentVersion,approvedMetadata.contentVersion);
  assert.equal(record.reviewedArtCommit,'7720bea2166735f4930abea1fa4f350ffdd4d69a');
  assert.equal(record.reviewedIntegrationCommit,'7fd2a93d68c4396b2d535a7d43ca7e7d5566d37d');
  assert.equal(record.assets.animation.length,28);
  assert.equal(record.assets.tiles.length,8);
  assert.equal(record.assets.tileAtlases.length,2);
  const pinned=Object.values(record.assets).flat();
  assert.equal(new Set(pinned.map(asset=>asset.path)).size,38);
  const actual=(await Promise.all(['animation','tiles'].map(async dir=>
    (await readdir(new URL(`${dir}/`,base))).filter(name=>name.endsWith('.png')).map(name=>`${dir}/${name}`)))).flat().sort();
  assert.deepEqual(pinned.map(asset=>asset.path).sort(),actual);
  for(const asset of pinned)assert.equal(digest(await readFile(new URL(asset.path,base))),asset.sha256,asset.path);
  for(const asset of record.assets.animation) {
    const provenance=await json(asset.path.replace('.png','.provenance.json'));
    for(const [key,value] of Object.entries(approvedMetadata))assert.equal(provenance[key],value);
    assert.equal(provenance.atlasPngSha256,asset.sha256);
  }
});
