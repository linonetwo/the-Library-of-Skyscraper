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
  put('arena/release/rule-provenance-v0.4.0.json',{schemaVersion:1,version:'0.4.0',status:'local-candidate'});
  const graph=buildMetadata(root,'0.4.0');assert.deepEqual(graph.assets,metadata.assets);assert.equal(metadata.rules,undefined);assert.deepEqual(graph.rules.schemaVersions,[1,2]);assert.equal(graph.rules.provenance.path,'arena/release/rule-provenance-v0.4.0.json');assert.equal(graph.rules.provenance.sha256,createHash('sha256').update(JSON.stringify({schemaVersion:1,version:'0.4.0',status:'local-candidate'})).digest('hex'));
  const patch=buildMetadata(root,'0.4.1');assert.deepEqual(patch.assets,graph.assets);assert.deepEqual(patch.rules,graph.rules);assert.deepEqual(patch.dependencies,graph.dependencies);
  put('arena/client/public/assets/manifest.json',{approvalRecord:'arena/art/approval-v0.2.0.json'});put('arena/art/approval-v0.2.0.json','legacy approval');put('arena/client/public/assets/animation/coverage.json',{contentVersion:'legacy'});put('arena/client/public/assets/tiles/manifest.json',{contentVersion:'old-tiles',schemaVersion:1});
  const legacy=buildMetadata(root,'0.2.0');assert.deepEqual(buildMetadata(root,'0.2.1'),legacy);assert.equal(legacy.assets.approval.path,'arena/art/approval-v0.2.0.json');assert.equal(legacy.assets.animation.contentVersion,'legacy');assert.equal(legacy.assets.provenance,undefined);
 } finally {rmSync(root,{recursive:true,force:true});}
});

test('v0.5 mobility metadata follows shipped registration, partial directions, SDK and map',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'arena-release-mobility-'));
 const put=(path,value)=>{mkdirSync(resolve(root,path,'..'),{recursive:true});writeFileSync(resolve(root,path),typeof value==='string'?value:JSON.stringify(value));};
 const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
 const indexPath='arena/client/dist/assets/player/index.json';
 const clip=action=>({action,root:`/assets/mobility/${action}`,descriptor:'atlas.json'});
 try {
  for(const name of ['client','script-sdk','script-toolchain','tools']) put(`arena/${name}/package.json`,{version:name==='script-sdk'?'0.0.3':'fixture'});
  for(const name of ['server','script-runner']) put(`arena/${name}/Cargo.toml`,'version = "fixture"');
  for(const path of ['client/package-lock.json','script-toolchain/package-lock.json','tools/package-lock.json','server/Cargo.lock','script-runner/Cargo.lock']) put('arena/'+path,'lock');
  put('arena/art/asset-provenance-v0.3.0.json',{groups:{player:{entries:['player/index.json'],index:'player/index.json'}}});
  put('arena/release/rule-provenance-v0.4.0.json',{version:'0.4.0',releaseApproved:false});
  put('arena/script-sdk/src/mobility.ts','export type MobilityAction = "run" | "jump" | "climb";');
  put('arena/shared/world-map-v5.json',{version:'fixture-library-v5.0',mobilityEdges:[]});
  put('arena/client/public/assets/player/index.json',{assetSetId:'wrong-public',clips:[clip('climb')]});
  put(indexPath,{assetSetId:'shipped-two-directions',clips:[clip('run'),clip('jump')]});
  const run={directions:['NE','SW'],phaseFrames:{wrongTopLevel:{first:0,last:9}}};
  const jump={directions:['NE','SW'],clip:{phaseFrames:{takeoff:{first:0,last:0},airborne:{first:1,last:2},landing:{first:3,last:3}}}};
  put('arena/client/dist/assets/mobility/run/atlas.json',run);
  put('arena/client/dist/assets/mobility/jump/atlas.json',jump);
  // A descriptor on disk alone does not register a clip.
  put('arena/client/dist/assets/mobility/climb/atlas.json',{directions:['NE','SW'],clip:{phaseFrames:{grip:{first:0,last:0}}}});
  const initial=buildMetadata(root,'0.5.0');
  const player=initial.assets.groups.player;
  assert.equal(player.assetSetId,'shipped-two-directions');
  assert.deepEqual(player.clips.map(c=>c.action),['run','jump']);
  assert.deepEqual(player.clips[0].directions,['NE','SW']);
  assert.equal(Object.hasOwn(player.clips[0],'phaseFrames'),false);
  assert.deepEqual(player.clips[1].phaseFrames,jump.clip.phaseFrames);
  assert.equal(player.clips[1].descriptor.sha256,hash(jump));
  assert.equal(initial.assets.provenance.scope,'inherited-baseline');
  assert.equal(initial.assets.provenance.version,'0.3.0');
  assert.equal(initial.rules.provenance.scope,'inherited-baseline');
  assert.equal(initial.rules.provenance.version,'0.4.0');
  assert.deepEqual(initial.rules.schemaVersions,[1,2]);
  assert.equal(initial.rules.sdk.version,initial.modules['script-sdk']);
  assert.deepEqual(initial.rules.sdk.mobility,{path:'arena/script-sdk/src/mobility.ts',sha256:hash('export type MobilityAction = "run" | "jump" | "climb";')});
  assert.deepEqual(initial.world,{simulationVersion:7,version:'fixture-library-v5.0',map:{path:'arena/shared/world-map-v5.json',sha256:hash({version:'fixture-library-v5.0',mobilityEdges:[]})}});
  const composition=buildMetadata(root,'0.6.0');
  const expected=structuredClone(initial);
  expected.assets.provenance.note='Inherited art provenance; not v0.6.0 approval.';
  expected.rules.provenance.note='Inherited rules provenance; not v0.6.0 approval.';
  expected.rules.composition={schemaVersion:2,moduleKinds:['gather','haul','build','defend','retreat','scout','patrol','escort'],references:['room','ownRole'],moduleVisits:{traceVersion:2,perActorLimit:8,missing:'unrecorded',truncatedField:'moduleVisitsTruncated'}};
  assert.deepEqual(composition,expected,'v0.6 changes only target-version notes and composition capabilities');
  assert.equal(initial.assets.provenance.note,'Inherited art provenance; not v0.5.0 approval.');
  assert.equal(initial.rules.provenance.note,'Inherited rules provenance; not v0.5.0 approval.');
  assert.equal(Object.hasOwn(initial.rules,'composition'),false);


  put(indexPath,{assetSetId:'shipped-two-directions',clips:[clip('run'),clip('jump'),clip('climb')]});
  const climb={directions:['NE','SW'],clip:{phaseFrames:{grip:{first:0,last:1},crestUp:{first:2,last:2},descend:{first:3,last:3}}}};
  put('arena/client/dist/assets/mobility/climb/atlas.json',climb);
  const registered=buildMetadata(root,'0.5.0').assets.groups.player.clips[2];
  assert.equal(registered.action,'climb');
  assert.deepEqual(registered.phaseFrames,climb.clip.phaseFrames);
  assert.deepEqual(registered.directions,['NE','SW']);
  assert.equal(registered.descriptor.sha256,hash(climb));
  climb.clip.phaseFrames.crestUp={first:2,last:3};
  put('arena/client/dist/assets/mobility/climb/atlas.json',climb);
  const updated=buildMetadata(root,'0.5.0').assets.groups.player.clips[2];
  assert.deepEqual(updated.phaseFrames,climb.clip.phaseFrames);
  assert.notEqual(updated.descriptor.sha256,registered.descriptor.sha256);
  assert.equal(updated.descriptor.sha256,hash(climb));
  const v6=buildMetadata(root,'0.6.0');assert.deepEqual(v6.assets.groups.player.clips,buildMetadata(root,'0.5.0').assets.groups.player.clips);assert.deepEqual(v6.world,initial.world);assert.deepEqual(v6.rules.sdk,initial.rules.sdk);assert.deepEqual(v6.dependencies,initial.dependencies);
 } finally {rmSync(root,{recursive:true,force:true});}
});

test('unknown external versions never fall through to a legacy recipe',()=>{
 for(const version of ['0.1.0','0.6.1','0.7.0','latest','__proto__'])assert.throws(()=>buildMetadata('/not-an-installation',version),/Unsupported release version/);
});
