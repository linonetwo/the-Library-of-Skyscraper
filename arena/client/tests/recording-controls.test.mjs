import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from '../node_modules/esbuild/lib/main.js';
async function bundled(file){const r=await build({entryPoints:[new URL(file,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
const {indexRecording}=await bundled('../src/recording-debug/index.ts');
const {findRecordingEvidence}=await bundled('../src/recording-debug/selection.ts');
const {rangeKey,loadRanges,saveRange}=await bundled('../src/recording-debug/ranges.ts');
const recording=JSON.parse(await readFile(new URL('./fixtures/recorded-modules-v6-normal.json',import.meta.url),'utf8'));
const sourceHash=recording.ruleHistory.changes[0].sourceHash,index=indexRecording(recording,'p1');

test('visible node/module filters use explicit outcomes and preserve decision tick and original operation',()=>{
  const filter={sourceHash,actorId:'p1-guard',target:'module',objectId:'escort-cargo',kind:'fallback'};
  const fallback=findRecordingEvidence(index,filter,3,'next');
  assert.equal(fallback.kind,'module');assert.equal(fallback.fact.operationIndex,4);assert.equal(fallback.fact.tick,0);
  assert.equal(findRecordingEvidence(index,{...filter,kind:'hit'},4,'next').fact.operationIndex,16);
  assert.equal(findRecordingEvidence(index,{...filter,target:'node',objectId:'escort-node'},3,'next').fact.visit.fallbackNodeId,'patrol-node');
  const selected=findRecordingEvidence(index,{...filter,target:'node',objectId:'escort-node',kind:'hit'},16,'next');
  assert.equal(selected.kind,'node');assert.equal(selected.fact.operationIndex,21);
  assert.equal(findRecordingEvidence(index,{...filter,sourceHash:'new-draft-with-same-id'},3,'next'),null);
});

test('two named recording intervals persist independently per session/owner/version and contain no credentials',()=>{
  const data=new Map(),store={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const identity={sessionId:recording.sessionId,ownerId:'p1'};
  const first={...identity,sourceHash,name:'回退基线',fromOperation:4,toOperation:4};
  const second={...identity,sourceHash:'other-archive',name:'发布后区间',fromOperation:16,toOperation:21};
  let ranges=saveRange(store,identity,[],first);ranges=saveRange(store,identity,ranges,second);
  assert.deepEqual(loadRanges(store,identity),[first,second]);
  assert.deepEqual(loadRanges(store,{...identity,ownerId:'p2'}),[]);
  assert.deepEqual(loadRanges(store,{...identity,sessionId:'other-session'}),[]);
  assert.throws(()=>saveRange(store,identity,ranges,{...first,ownerId:'p2'}),/another/);
  assert.notEqual(rangeKey(identity),rangeKey({...identity,ownerId:'p2'}));
  assert.deepEqual(Object.keys(JSON.parse(data.get(rangeKey(identity)))[0]).sort(),['fromOperation','name','ownerId','sessionId','sourceHash','toOperation']);
});
