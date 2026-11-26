import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from '../node_modules/esbuild/lib/main.js';
async function bundled(file){const r=await build({entryPoints:[new URL(file,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
const {readArchivedRuleGraph,getGraphSourceRef}=await bundled('../../behavior-modules/graph/index.ts');
const {indexRecording}=await bundled('../src/recording-debug/index.ts');
const {findRecordingEvidence}=await bundled('../src/recording-debug/selection.ts');
const sample=JSON.parse(await readFile(new URL('./fixtures/recording-archives-v6.json',import.meta.url),'utf8'));

test('both actual before/after helper-version archives supply the historical node/module denominator and their original source lines',()=>{
  const [v1,v2]=sample.versions;
  assert.notEqual(v1.sourceHash,v2.sourceHash);assert.notEqual(v1.graphPlanSha256,v2.graphPlanSha256);
  for(const version of sample.versions){
    const graph=readArchivedRuleGraph(version.project);
    assert.ok(graph.modules.some(module=>module.moduleId==='escort-cargo'));
    assert.ok(graph.nodes.some(node=>node.id==='escort-node'));
    assert.deepEqual(getGraphSourceRef(version.project,'escort-node'),{file:'graph-plan.ts',line:106,column:1});
    assert.deepEqual(getGraphSourceRef(version.project,'escort-cargo'),{file:'graph-plan.ts',line:115,column:1});
    assert.match(version.project.files['graph-plan.ts'].split('\n')[105],/"id":"escort-node"/);
  }
  assert.equal(readArchivedRuleGraph({files:{'main.ts':'export const decide=()=>({intents:[]});'}}),null);
});

test('same node/module IDs across actual versions keep old reason and new cargo evidence separate at original operations',()=>{
  const index=indexRecording({sessionId:sample.sessionId,ruleHistory:{playerId:sample.ownerId,changes:sample.versions.map(v=>v.change)}},sample.ownerId);
  const query={actorId:'p1-guard',target:'module',objectId:'escort-cargo',kind:'fallback'};
  const old=findRecordingEvidence(index,{...query,sourceHash:sample.versions[0].sourceHash},-1,'next');
  const current=findRecordingEvidence(index,{...query,sourceHash:sample.versions[1].sourceHash},-1,'next');
  assert.equal(old.fact.operationIndex,4);assert.equal(old.fact.visit.reasonCode,'escort-target-missing');assert.equal(old.fact.visit.observed,undefined);
  assert.equal(current.fact.operationIndex,35);assert.equal(current.fact.tick,28);
  assert.equal(current.fact.visit.reasonCode,'escort-cargo-insufficient');assert.deepEqual(current.fact.visit.observed,{cargo:0,threshold:4});
  assert.equal(current.fact.visit.resolvedId,'p1-gatherer');assert.equal(current.fact.visit.fallbackNodeId,'patrol-node');
});
