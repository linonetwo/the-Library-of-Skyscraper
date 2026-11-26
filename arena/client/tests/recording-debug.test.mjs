import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from '../node_modules/esbuild/lib/main.js';
async function bundled(file) {
  const result = await build({entryPoints:[new URL(file,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const {indexRecording,nextNode} = await bundled('../src/recording-debug/index.ts');
const {nodeCoverage} = await bundled('../src/recording-debug/coverage.ts');
const recording = JSON.parse(await readFile(new URL('./fixtures/recording-trace-v5.json',import.meta.url),'utf8'));
const first = recording.ruleHistory.changes[0], hash = first.sourceHash;
const query = {sourceHash:hash,actorId:'p1-guard',nodeId:'run-support',kind:'selected'};
const range = {sessionId:recording.sessionId,ownerId:'p1',sourceHash:hash,name:'桥段实录',fromOperation:24,toOperation:36};

test('real owner recording indexes original decision operations and selected intent, not module outcomes',()=>{
  const original = structuredClone(recording), index = indexRecording(recording,'p1');
  assert.equal(nextNode(index,query,23).operationIndex,24);
  assert.equal(nextNode(index,query,24).operationIndex,25);
  assert.equal(nextNode(index,query,25,'previous').operationIndex,24);
  assert.equal(nextNode(index,{...query,sourceHash:'different-version'},0),null);
  assert.equal(nextNode(index,{...query,actorId:'p1-scout'},0),null);
  const count = nodeCoverage(index,range,'p1-guard','run-support');
  const actual = recording.ruleHistory.changes.filter(c=>c.operationIndex>=24&&c.operationIndex<=36)
    .filter(c=>c.memoryPatch.set.aiTrace.actors.find(a=>a.actorId==='p1-guard').selectedNodeId==='run-support');
  assert.deepEqual(count.selectedOperations,actual.map(c=>c.operationIndex));
  assert.equal(count.moduleOutcome,'unrecorded');assert.equal(count.unvisitedCount,null);
  assert.deepEqual(recording,original);
});

test('projected repeated memory on display frames adds no visits; only explicit decision deltas count',()=>{
  const one = {...recording,ruleHistory:{playerId:'p1',changes:[first]}};
  const frames = [24,25,26,27].map(operationIndex=>({operationIndex,tick:16,snapshot:{memory:first.memoryPatch.set}}));
  const index = indexRecording({...one,frames},'p1');
  const count = nodeCoverage(index,range,'p1-guard','run-support');
  assert.equal(count.visitCount,1);assert.deepEqual(count.visitOperations,[24]);assert.deepEqual(count.selectedOperations,[24]);
});

test('controlled reset/same-tick and two-version boundaries seek by operation, not tick or node id alone',()=>{
  const a=structuredClone(first), b=structuredClone(first);
  a.operationIndex=10;b.operationIndex=12;b.sourceHash='version-B';
  const r={sessionId:'reset-case',ruleHistory:{playerId:'p1',changes:[a,{operationIndex:11,reset:true},b]}};
  const index=indexRecording(r,'p1');
  assert.equal(index.decisions[0].tick,index.decisions.at(-1).tick);
  assert.equal(nextNode(index,query,9).operationIndex,10);
  assert.equal(nextNode(index,query,10),null);
  assert.equal(nextNode(index,{...query,sourceHash:'version-B'},10).operationIndex,12);
  assert.deepEqual(index.resetOperations,[11]);
  const named={...range,sessionId:'reset-case',fromOperation:12,toOperation:12};
  assert.equal(nodeCoverage(index,named,'p1-guard','run-support').visitCount,0);
  assert.equal(nodeCoverage(index,{...named,sourceHash:'version-B'},'p1-guard','run-support').visitCount,1);
});

test('owner/session isolation refuses another owner history and a foreign named interval',()=>{
  const index=indexRecording(recording,'p1');
  assert.throws(()=>indexRecording(recording,'p2'),/owner/);
  const other={...recording,ruleHistory:{...recording.ruleHistory,playerId:'p2'}};
  assert.equal(indexRecording(other,'p2').ownerId,'p2'); // controlled owner-boundary fixture
  assert.throws(()=>nodeCoverage(index,{...range,ownerId:'p2'},'p1-guard','run-support'),/another/);
  assert.throws(()=>nodeCoverage(index,{...range,sessionId:'another-session'},'p1-guard','run-support'),/another/);
});

test('missing trace, no recorded visit and unavailable history remain different evidence states',()=>{
  const missing={operationIndex:25,tick:17,sourceHash:hash,memoryPatch:{set:{counter:1}}};
  const index=indexRecording({...recording,ruleHistory:{playerId:'p1',changes:[first,missing]}},'p1');
  const absent=nodeCoverage(index,range,'p1-guard','not-in-trace');
  assert.deepEqual(absent.noRecordedVisitOperations,[24]);assert.deepEqual(absent.missingTraceOperations,[25]);
  assert.equal(absent.unvisitedCount,null);assert.equal(absent.moduleOutcome,'unrecorded');
  assert.equal(nodeCoverage(indexRecording({sessionId:recording.sessionId},'p1'),range,'p1-guard','run-support').historyAvailable,false);
  const old={...missing,memoryPatch:{set:{aiTrace:{v:1,tick:17,actors:[]}}}};
  assert.deepEqual(indexRecording({...recording,ruleHistory:{playerId:'p1',changes:[old]}},'p1').missingTraces.map(x=>x.operationIndex),[25]);
});

test('multiple visits preserve comparison values while selected-only evidence never invents a visit',()=>{
  const change=structuredClone(first),actor=change.memoryPatch.set.aiTrace.actors.find(a=>a.actorId==='p1-guard');
  actor.visited=[{nodeId:'check',value:false},{nodeId:'check',value:3}];actor.selectedNodeId='selected-outside-bounded-list';
  const index=indexRecording({...recording,ruleHistory:{playerId:'p1',changes:[change]}},'p1');
  assert.deepEqual(nextNode(index,{...query,nodeId:'check',kind:'visit'},23).visits,[{value:false},{value:3}]);
  assert.equal(nodeCoverage(index,range,'p1-guard','check').visitCount,2);
  assert.equal(nextNode(index,{...query,nodeId:'selected-outside-bounded-list'},23).selected,true);
  assert.equal(nextNode(index,{...query,nodeId:'selected-outside-bounded-list',kind:'visit'},23),null);
  assert.throws(()=>nodeCoverage(index,{...range,fromOperation:9,toOperation:8},'p1-guard','check'),/Invalid/);
});
