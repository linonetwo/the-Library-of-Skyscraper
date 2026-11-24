import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildMetadata } from '../release/manifest.mjs';

test('v0.3 metadata hashes shipped dist bytes and follows actual index clips',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'arena-release-metadata-'));
 const put=(path,value)=>{mkdirSync(resolve(root,path,'..'),{recursive:true});writeFileSync(resolve(root,path),typeof value==='string'?value:JSON.stringify(value));};
 try {
  for(const name of ['client','script-sdk','script-toolchain','tools']) put(`arena/${name}/package.json`,{version:'test'});
  for(const name of ['server','script-runner']) put(`arena/${name}/Cargo.toml`,'version = "test"');
  for(const path of ['client/package-lock.json','script-toolchain/package-lock.json','tools/package-lock.json','server/Cargo.lock','script-runner/Cargo.lock']) put('arena/'+path,'lock');
  put('arena/art/asset-provenance-v0.3.0.json',{groups:{player:{entries:['iso-v030-base/index.json'],index:'iso-v030-base/index.json'}}});
  put('arena/client/public/assets/iso-v030-base/index.json',{assetSetId:'wrong-public-source'});
  put('arena/client/dist/assets/iso-v030-base/index.json',{assetSetId:'actual-dist',clips:[{action:'new-action',root:'/assets/action-source',descriptor:'atlas.json'}]});
  put('arena/client/dist/assets/action-source/atlas.json','actual descriptor bytes');
  const metadata=buildMetadata(root,'0.3.0');
  assert.equal(metadata.assets.groups.player.assetSetId,'actual-dist');
  assert.equal(metadata.assets.groups.player.clips[0].action,'new-action');
  assert.deepEqual(metadata.assets.groups.player.clips[0].descriptor,{path:'arena/client/dist/assets/action-source/atlas.json',sha256:createHash('sha256').update('actual descriptor bytes').digest('hex')});
  assert.equal(metadata.assets.approval,undefined);
  put('arena/client/public/assets/manifest.json',{approvalRecord:'arena/art/approval-v0.2.0.json'});put('arena/art/approval-v0.2.0.json','legacy approval');put('arena/client/public/assets/animation/coverage.json',{contentVersion:'legacy'});put('arena/client/public/assets/tiles/manifest.json',{contentVersion:'old-tiles',schemaVersion:1});
  const legacy=buildMetadata(root,'0.2.0');assert.equal(legacy.assets.approval.path,'arena/art/approval-v0.2.0.json');assert.equal(legacy.assets.animation.contentVersion,'legacy');assert.equal(legacy.assets.provenance,undefined);
 } finally {rmSync(root,{recursive:true,force:true});}
});
