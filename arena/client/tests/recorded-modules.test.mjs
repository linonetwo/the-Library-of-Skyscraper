import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from '../node_modules/esbuild/lib/main.js';
async function bundled(file) {
  const result=await build({entryPoints:[new URL(file,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const {indexRecording}=await bundled('../src/recording-debug/index.ts');
const {moduleEvidence,nextModule,moduleCoverage}=await bundled('../src/recording-debug/modules.ts');
const sample=JSON.parse(await readFile(new URL('./fixtures/composition-trace-v6.json',import.meta.url),'utf8'));
// A1's independent V8 sample has no operation. This explicit test envelope is NOT a real owner timeline.
const hash=sample.sourceHash;
const envelope=(operationIndex,trace=sample.trace,sourceHash=hash)=>({operationIndex,tick:sample.tick,sourceHash,memoryPatch:{set:{aiTrace:trace}}});
const recording=(changes)=>({sessionId:'adapter-test',ruleHistory:{playerId:sample.owner,changes}});
const range={sessionId:'adapter-test',ownerId:sample.owner,sourceHash:hash,name:'V8适配回归',fromOperation:40,toOperation:49};
const query={sourceHash:hash,actorId:'s',moduleId:'scout-risk',kind:'fallback'};

test('real independent V8 facts retain fallback target, actual values and reference without guessing from selected node',()=>{
  const trace=structuredClone(sample.trace);trace.actors.find(a=>a.actorId==='s').selectedNodeId='later-selected-leaf';
  const index=indexRecording(recording([envelope(40,trace)]),sample.owner);
  const event=nextModule(index,query,39);
  assert.equal(event.operationIndex,40);assert.equal(event.tick,10);
  assert.deepEqual(event.visit.observed,{enemyHp:4,threshold:2});assert.deepEqual(event.visit.ref,{roomId:'r2',type:'room'});
  assert.equal(event.visit.resolvedId,'r2');assert.equal(event.visit.fallbackNodeId,'fallback');assert.equal(event.visit.reasonCode,'risk-exceeded');
  assert.equal(nextModule(index,{...query,nodeId:'later-selected-leaf'},39),null);
  assert.equal(nextModule(index,{...query,actorId:'g'},39),null);
  assert.equal(nextModule(index,{...query,sourceHash:'wrong-version'},39),null);
});

test('hold is both module hit and hold; it is not a module fallback or authority arrival',()=>{
  const index=indexRecording(recording([envelope(40)]),sample.owner);
  const q={sourceHash:hash,actorId:'g',moduleId:'scout-home',kind:'hit'};
  assert.equal(nextModule(index,q,39).visit.outcome,'hold');
  assert.equal(nextModule(index,{...q,kind:'hold'},39).visit.reasonCode,'scout-reported');
  assert.equal(nextModule(index,{...q,kind:'fallback'},39),null);
  const c=moduleCoverage(index,range,{actorId:'g',moduleId:'scout-home'});
  assert.deepEqual([c.visitCount,c.hitCount,c.holdCount,c.fallbackCount],[1,1,1,0]);
});

test('missing, complete empty and truncated lists have distinct coverage, with original operation links',()=>{
  const missing=structuredClone(sample.trace),empty=structuredClone(sample.trace),truncated=structuredClone(sample.trace);
  delete missing.actors[1].moduleVisits;empty.actors[1].moduleVisits=[];
  truncated.actors[1].moduleVisits=[];truncated.actors[1].moduleVisitsTruncated=true;
  const noTrace={operationIndex:44,tick:10,sourceHash:hash,memoryPatch:{set:{counter:1}}};
  const index=indexRecording(recording([envelope(40),envelope(41,missing),envelope(42,empty),envelope(43,truncated),noTrace]),sample.owner);
  const c=moduleCoverage(index,range,{actorId:'s',moduleId:'scout-risk'});
  assert.deepEqual(c.visitOperations,[40]);assert.deepEqual(c.fallbackOperations,[40]);
  assert.deepEqual(c.missingModuleOperations,[41]);assert.deepEqual(c.unvisitedOperations,[42]);
  assert.deepEqual(c.truncatedOperations,[43]);assert.deepEqual(c.missingTraceOperations,[44]);
  assert.deepEqual(moduleCoverage(index,range,{actorId:'s',moduleId:'another-module'}).unvisitedOperations,[40,42]);
});

test('listed visits remain proof when truncated; repeated module visits count once per actual visit and link unique operations',()=>{
  const trace=structuredClone(sample.trace),actor=trace.actors[1];
  actor.moduleVisits.push(structuredClone(actor.moduleVisits[0]));actor.moduleVisitsTruncated=true;
  const index=indexRecording(recording([envelope(40,trace)]),sample.owner);
  const c=moduleCoverage(index,range,{actorId:'s',moduleId:'scout-risk'});
  assert.equal(c.visitCount,2);assert.equal(c.fallbackCount,2);assert.deepEqual(c.fallbackOperations,[40]);
  assert.deepEqual(c.truncatedOperations,[40]);assert.deepEqual(c.unvisitedOperations,[]);
  assert.deepEqual(moduleEvidence(index,query).map(e=>e.visitIndex),[0,1]);
});

test('same-tick reset/version and named interval navigation stays on original operation identity',()=>{
  const index=indexRecording(recording([envelope(40),{operationIndex:41,reset:true},envelope(42),envelope(43,sample.trace,'other')]),sample.owner);
  assert.equal(nextModule(index,query,40).operationIndex,42);
  assert.equal(nextModule(index,query,42,'previous').operationIndex,40);
  assert.equal(nextModule(index,query,42),null);
  const c=moduleCoverage(index,{...range,fromOperation:42,toOperation:42},{actorId:'s',moduleId:'scout-risk'});
  assert.deepEqual(c.fallbackOperations,[42]);
  assert.throws(()=>moduleCoverage(index,{...range,ownerId:'another-owner'},{actorId:'s'}),/another/);
  assert.throws(()=>moduleCoverage(index,{...range,toOperation:1},{actorId:'s'}),/Invalid/);
});

test('normal-clock owner operations preserve actual escort fallback, travel hold, scout report and new escort selection',async()=>{
  const r=JSON.parse(await readFile(new URL('./fixtures/recorded-modules-v6-normal.json',import.meta.url),'utf8'));
  const index=indexRecording(r,'p1'),sourceHash=r.ruleHistory.changes[0].sourceHash;
  const q={sourceHash,actorId:'p1-guard',moduleId:'escort-cargo',kind:'fallback'};
  const fallback=nextModule(index,q,3);assert.equal(fallback.operationIndex,4);assert.equal(fallback.tick,0);
  assert.equal(fallback.visit.fallbackNodeId,'patrol-node');assert.equal(fallback.visit.reasonCode,'escort-target-missing');
  const hold=nextModule(index,{...q,kind:'hit'},4);assert.equal(hold.operationIndex,16);assert.equal(hold.visit.reasonCode,'travel-active');
  assert.deepEqual(hold.visit.observed,{cargo:4,threshold:4});assert.equal(hold.visit.resolvedId,'p1-gatherer');
  const moving=nextModule(index,{...q,kind:'hit'},16);assert.equal(moving.operationIndex,21);assert.equal(moving.visit.outcome,'selected');
  assert.deepEqual(moving.visit.observed,{cargo:8,threshold:4});
  const scout=nextModule(index,{sourceHash,actorId:'p1-scout',moduleId:'scout-resource',kind:'hit'},3);
  assert.equal(scout.operationIndex,18);assert.equal(scout.tick,14);assert.equal(scout.visit.reasonCode,'scout-reported');assert.equal(scout.visit.resolvedId,'room-1');
  const c=moduleCoverage(index,{sessionId:r.sessionId,ownerId:'p1',sourceHash,name:'真实护送原操作摘录',fromOperation:4,toOperation:21},{actorId:'p1-guard',moduleId:'escort-cargo'});
  assert.deepEqual(c.visitOperations,[4,16,21]);assert.deepEqual(c.hitOperations,[16,21]);assert.deepEqual(c.fallbackOperations,[4]);
});
