import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../node_modules/esbuild/lib/main.js';
async function bundled(file){const built=await build({entryPoints:[new URL(file,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));}
const {createLogisticsGraph,createRetreatGraph}=await bundled('../../behavior-modules/graph/examples.ts');
const {applyGraphPatch,proposeGoals,selectedGoalPatch,inverseGoalPatch}=await bundled('../src/rule-goals/goals.ts');
const {diagnoseGraph}=await bundled('../../behavior-modules/graph/diagnostics.ts');
test('Chinese cargo goal describes real stable objects and supports mixed acceptance and undo',()=>{
 const graph=createLogisticsGraph(),before=structuredClone(graph);
 const proposal=proposeGoals(graph,'采撷师载量到6就回仓');
 assert.deepEqual(proposal.errors,[]);assert.deepEqual(proposal.changes.map(c=>c.objectId),['start-return','cargo-check']);
 const patch=selectedGoalPatch(graph,proposal,[proposal.changes[0].id]);const result=applyGraphPatch(graph,patch);
 assert.equal(result.transitions.find(t=>t.id==='start-return').condition.value,6);
 assert.equal(result.nodes.find(n=>n.id==='cargo-check').condition.value,8);
 assert.deepEqual(graph,before);assert.deepEqual(diagnoseGraph(result).filter(d=>d.severity==='error'),[]);
 const restored=applyGraphPatch(result,inverseGoalPatch(graph,result,patch));
 assert.deepEqual({...restored,revision:graph.revision},graph);
});
test('HP words use the selected role initial transition and explicit comparison keeps <=',()=>{
 const graph=createRetreatGraph(),proposal=proposeGoals(graph,'守卷人生命低于20撤退');
 assert.deepEqual(proposal.errors,[]);assert.equal(proposal.changes[0].objectId,'low-hp-guarding');assert.equal(proposal.changes[0].operation.transition.condition.op,'lt');
 const explicit=proposeGoals(graph,'转移 low-hp-guarding：HP <= 25');assert.equal(explicit.changes[0].operation.transition.condition.op,'lte');
 assert.deepEqual(proposeGoals(createLogisticsGraph(),'守卷人生命低于20撤退').changes,[]);
});
test('unsupported, absent, ambiguous and out-of-range targets do not silently modify graph',()=>{
 const graph=createLogisticsGraph();
 for(const text of ['帮我赢得战争','条件 absent：载量 >= 12','条件 cargo-check：HP <= 101','连接 cargo-check：是→missing，否→gather-node']){
  const p=proposeGoals(graph,text);assert.equal(p.changes.length,0,text);assert.equal(p.errors.length,1,text);
 }
 graph.transitions.push({...graph.transitions[0],id:'duplicate-route'});assert.match(proposeGoals(graph,'采撷师载量到6就回仓').errors[0],/2 条/);
});
test('each accepted patch requires exact baseline and real selected ids',()=>{
 const graph=createLogisticsGraph(),proposal=proposeGoals(graph,'采撷师载量到6就回仓');
 assert.throws(()=>selectedGoalPatch({...graph,revision:1},proposal,['change-1']),/基线过期/);
 const edited=structuredClone(graph);edited.states[0].name='changed';assert.throws(()=>selectedGoalPatch(edited,proposal,['change-1']),/基线过期/);
 assert.throws(()=>selectedGoalPatch(graph,proposal,['missing']),/不存在/);assert.throws(()=>selectedGoalPatch(graph,proposal,[]),/至少/);
});
test('module roles/target and branch wiring produce typed real operations; unsupported lines stay separate',()=>{
 const graph=createLogisticsGraph(),p=proposeGoals(graph,'模块 gather：岗位=采撷师，目标=room-2\n连接 cargo-check：是→gather-node，否→haul-node\n自动修复技能');
 assert.equal(p.changes.length,2);assert.equal(p.errors.length,1);const result=applyGraphPatch(graph,selectedGoalPatch(graph,p,p.changes.map(c=>c.id)));
 assert.equal(result.modules.find(m=>m.moduleId==='gather').config.targetRoomId,'room-2');assert.equal(result.nodes.find(n=>n.id==='cargo-check').yes,'gather-node');
 assert.ok(diagnoseGraph(result).every(d=>d.severity!=='error'));
});
test('conflicting repeated object goals reject that item rather than overwrite a previous proposal',()=>{
 const p=proposeGoals(createLogisticsGraph(),'条件 cargo-check：载量 >= 6\n条件 cargo-check：载量 >= 10');assert.equal(p.changes.length,1);assert.match(p.errors[0],/重复/);
});

test('natural goal refuses disabled destinations rather than inventing a supported behavior',()=>{
 const graph=createRetreatGraph();graph.modules.find(m=>m.kind==='retreat').enabled=false;
 const proposal=proposeGoals(graph,'守卷人生命低于25撤退');assert.equal(proposal.changes.length,0);assert.equal(proposal.errors.length,1);
 const large=proposeGoals(graph,'条件 cargo-check：载量 >= 999999999999999999999');assert.equal(large.changes.length,0);assert.match(large.errors[0],/安全范围/);
});

test('natural goal refuses incompatible module role or a hidden higher unload threshold',()=>{
 const graph=createLogisticsGraph();graph.modules.find(m=>m.kind==='haul').config.minCargo=8;
 assert.equal(proposeGoals(graph,'采撷师载量到6就回仓').changes.length,0);
 const retreat=createRetreatGraph();retreat.modules.find(m=>m.kind==='retreat').roleFilter=['scout'];
 assert.equal(proposeGoals(retreat,'守卷人生命低于25撤退').changes.length,0);
});

test('natural return goal never flips an inverse or differently wired cargo condition',()=>{
 for(const inverse of [true,false]){
  const graph=createLogisticsGraph(),node=graph.nodes.find(n=>n.id==='cargo-check');
  node.condition.op=inverse?'lt':'gte';node.yes='gather-node';node.no='haul-node';
  const p=proposeGoals(graph,'采撷师载量到6就回仓');
  assert.deepEqual(p.changes.map(c=>c.objectId),['start-return']);assert.match(p.errors[0],/真假出口方向/);
  const result=applyGraphPatch(graph,selectedGoalPatch(graph,p,p.changes.map(c=>c.id)));
  assert.deepEqual(result.nodes.find(n=>n.id==='cargo-check'),node);
 }
});
