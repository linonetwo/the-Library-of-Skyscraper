import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {build} from '../../script-toolchain/node_modules/esbuild/lib/main.js';
import {compileRule} from '../../script-toolchain/src/compile.mjs';
const built=await build({entryPoints:[new URL('./index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const actor={id:'a',owner:'p',role:'gatherer',roomId:'room-1',hp:100,maxHp:100,state:'idle',cargo:7,cargoCapacity:24};
const context=(patch={},memory={},tick=5)=>({tick,player:{id:'p',materials:40},squad:{actors:[{...actor,...patch}]},world:{rooms:[{id:'room-0',kind:'base',q:0,r:0,resources:0,enemyHp:0},{id:'room-1',kind:'resource',q:1,r:0,resources:100,enemyHp:0},{id:'room-3',kind:'ruins',q:0,r:1,resources:0,enemyHp:10}],actors:[],buildings:[]},memory,tasks:{items:[]},limits:{maxIntents:5,maxMemoryBytes:16384,maxTaskPatches:10}});
async function executable(graph){const project=api.toGraphSourceProject(graph);const compiled=await compileRule(project);assert.deepEqual(compiled.diagnostics,[]);return {project,compiled,decide(ctx){const sandbox=vm.createContext({});vm.runInContext(compiled.bundle.code,sandbox);return JSON.parse(JSON.stringify(sandbox.__arenaRule.decide(ctx)));}};}
test('graph diagnostics and immutable serializable patch baseline',()=>{
 const graph=api.createLogisticsGraph();assert.deepEqual(api.diagnoseGraph(graph).filter(d=>d.severity==='error'),[]);
 const node=graph.nodes.find(n=>n.id==='cargo-check');const changed=api.applyGraphPatch(graph,{graphId:graph.graphId,baseRevision:0,operations:[{type:'putNode',node:{...node,condition:{...node.condition,value:6}}}]});
 assert.equal(graph.revision,0);assert.equal(changed.revision,1);assert.equal(node.condition.value,8);
 assert.throws(()=>api.applyGraphPatch(changed,{graphId:graph.graphId,baseRevision:0,operations:[]}),/stale/);
 changed.nodes.find(n=>n.id==='gather-node').fallback='cargo-check';assert.ok(api.diagnoseGraph(changed).some(d=>d.code==='tree-cycle'&&d.sourceRef?.file==='graph-plan.ts'));assert.throws(()=>api.toGraphSourceProject(changed));
});
test('logistics fixture compiles in existing toolchain and threshold changes actual V8 intent',async()=>{
 const graph=api.createLogisticsGraph();const a=await executable(graph);assert.equal(a.decide(context()).intents[0].type,'gather');
 const node=graph.nodes.find(n=>n.id==='cargo-check');node.condition.value=6;const b=await executable(graph);assert.equal(b.decide(context()).intents[0].type,'move');assert.notEqual(a.compiled.bundle.sourceHash,b.compiled.bundle.sourceHash);
 assert.deepEqual(api.recoverRuleGraph(a.project),api.createLogisticsGraph());
 for(const id of ['cargo-check','start-return','working','gather','role-gatherer'])assert.ok(api.getGraphSourceRef(a.project,id));
});
test('persistent FSM transitions once, retains per-actor state, entry and exit effects',async()=>{
 const run=await executable(api.createLogisticsGraph());const first=run.decide(context({cargo:8}));assert.equal(first.memoryPatch.set.aiTrace.v,2);assert.equal(first.memoryPatch.set.aiTrace.actors[0].transitionId,'start-return');assert.equal(first.memoryPatch.set.graphState.a.stateId,'returning');assert.equal(first.memoryPatch.set.graphState.a.values.phase,'return');
 const second=run.decide(context({cargo:0},first.memoryPatch.set,6));assert.equal(second.memoryPatch.set.aiTrace.actors[0].transitionId,'resume-work');assert.equal(second.memoryPatch.set.graphState.a.stateId,'working');
 const sameTick=run.decide(context({cargo:8},second.memoryPatch.set,6));assert.equal(sameTick.memoryPatch.set.aiTrace.actors[0].transitionId,null);
});
test('retreat fixture compiles and cooling transition respects minimum residence',async()=>{
 const run=await executable(api.createRetreatGraph());const low=run.decide(context({hp:10}));assert.equal(low.memoryPatch.set.aiTrace.actors[0].endStateId,'recovering-working');assert.equal(low.intents[0].type,'move');
 const early=run.decide(context({hp:80},low.memoryPatch.set,6));assert.equal(early.memoryPatch.set.aiTrace.actors[0].transitionId,null);
 const later=run.decide(context({hp:80},early.memoryPatch.set,9));assert.equal(later.memoryPatch.set.aiTrace.actors[0].transitionId,'recovered-working');
});
test('sequence checks, stable scoring and discarded logs commit only selected branch',async()=>{
 const graph=api.createLogisticsGraph();graph.states.find(s=>s.id==='working').treeId='ranked';
 graph.nodes.push({id:'ranked',type:'score',candidates:[{id:'rank-a',nodeId:'gated',weight:3},{id:'rank-b',nodeId:'selected-log',weight:3}],fallback:'hold-node'},
 {id:'gated',type:'sequence',children:['wrong-log','cargo-gate','gather-node'],fallback:'fail-check'},
 {id:'wrong-log',type:'log',reason:'discarded reason',next:'pass-check'},
 {id:'pass-check',type:'check',condition:{type:'compare',field:'hp',op:'gt',value:0,missing:false}},
 {id:'cargo-gate',type:'check',condition:{type:'compare',field:'cargo',op:'gt',value:10,missing:false}},
 {id:'fail-check',type:'check',condition:{type:'compare',field:'hp',op:'lt',value:0,missing:false}},
 {id:'selected-log',type:'log',reason:'selected reason',next:'gather-node'});
 const run=await executable(graph);const result=run.decide(context());assert.equal(result.intents.length,1);assert.match(result.memoryPatch.set.aiTrace.actors[0].reason,/selected reason/);assert.doesNotMatch(result.memoryPatch.set.aiTrace.actors[0].reason,/discarded/);
});
test('task plans and entry effects are actor isolated; quotas fail instead of green trace',async()=>{
 const graph=api.createLogisticsGraph();graph.states.find(s=>s.id==='working').entry.push({type:'task',taskId:'plan',roomId:'room-1',kind:'gather',priority:20});
 const run=await executable(graph);const ctx=context();ctx.squad.actors.push({...actor,id:'b',cargo:8});
 const result=run.decide(ctx);assert.equal(result.intents.length,2);assert.equal(result.memoryPatch.set.graphState.a.stateId,'working');assert.equal(result.memoryPatch.set.graphState.b.stateId,'returning');assert.deepEqual(result.taskPatches.map(p=>p.task.id),['plan-a','plan-b']);
 ctx.limits.maxMemoryBytes=10;assert.throws(()=>run.decide(ctx),/memory trace limit/);
});
test('real authority compiler/V8 preview and persistent live graph state', {skip:!process.env.ARENA_GRAPH_TEST_URL},async()=>{
 let session;const request=async(path,body)=>{const response=await fetch(process.env.ARENA_GRAPH_TEST_URL+'/api/sessions'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(session?{authorization:'Bearer '+session.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();assert.equal(response.ok,true,JSON.stringify(data));return data;};
 session=await request('',{mode:'training',seed:42});const path='/'+session.sessionId;await request(path+'/commands',{type:'pause',paused:true});
 const project=api.toGraphSourceProject(api.createLogisticsGraph());const before=await request(path+'/scripts/state');
 const preview=await request(path+'/scripts/preview',project);assert.deepEqual(preview.compilation.diagnostics,[]);assert.equal(preview.execution.decision.memoryPatch.set.aiTrace.v,2);assert.deepEqual(await request(path+'/scripts/state'),before);
 await request(path+'/scripts/publish',project);await request(path+'/commands',{type:'step',ticks:20});const state=await request(path+'/scripts/state');assert.equal(state.memory.aiTrace.v,2);assert.ok(state.memory.graphState['p1-gatherer'].stateId);assert.ok(state.memory.aiTrace.tick>0);
});
test('graph ID rename and fragment copy remap internal edges while sharing official bindings',()=>{
 const graph=api.createLogisticsGraph();const renamed=api.applyGraphPatch(graph,api.renameGraphObject(graph,'cargo-check','cargo-threshold'));
 assert.equal(renamed.states.find(s=>s.id==='working').treeId,'cargo-threshold');assert.ok(renamed.nodes.some(n=>n.id==='cargo-threshold'));assert.equal(api.diagnoseGraph(renamed).filter(d=>d.severity==='error').length,0);
 const fragment=api.cloneGraphFragment(graph,'cargo-check');const copied=api.applyGraphPatch(graph,fragment.patch);const root=copied.nodes.find(n=>n.id===fragment.rootId);assert.equal(root.yes,fragment.idMap['haul-node']);assert.equal(copied.nodes.find(n=>n.id===root.yes).moduleId,'haul');assert.equal(copied.modules.length,graph.modules.length);
 assert.throws(()=>api.renameGraphObject(graph,'cargo-check','gather'),/duplicate/);
});
test('explicit v1 conversion preserves action selection without mutating original plan',async()=>{
 const v1built=await build({entryPoints:[new URL('../index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});const v1=await import('data:text/javascript;base64,'+Buffer.from(v1built.outputFiles[0].text).toString('base64'));
 const plan=v1.createFirstExpeditionPlan();const before=JSON.stringify(plan);const graph=api.fromBehaviorPlan(plan);const graphRun=await executable(graph);assert.equal(JSON.stringify(plan),before);
 const compilation=await compileRule(v1.toRuleSourceProject(plan));assert.deepEqual(compilation.diagnostics,[]);
 for(const patch of [{},{cargo:8},{hp:10},{role:'guard'},{role:'scout'}]){
  const sandbox=vm.createContext({});vm.runInContext(compilation.bundle.code,sandbox);const old=JSON.parse(JSON.stringify(sandbox.__arenaRule.decide(context(patch))));assert.deepEqual(graphRun.decide(context(patch)).intents,old.intents);
 }
});
test('priority and score skip explicit pass but explicit hold terminates candidate selection',async()=>{
 for(const selector of ['priority','score']){
  const graph=api.createLogisticsGraph();graph.states.find(s=>s.id==='working').treeId='selector';graph.modules.find(m=>m.kind==='gather').enabled=false;
  graph.nodes.find(n=>n.id==='gather-node').fallback='pass-node';
  graph.nodes.push(selector==='priority'?{id:'selector',type:'priority',children:['gather-node','defend-node'],fallback:'hold-node'}:{id:'selector',type:'score',candidates:[{id:'first-score',nodeId:'gather-node',weight:10},{id:'second-score',nodeId:'defend-node',weight:5}],fallback:'hold-node'});
  const defend=graph.modules.find(m=>m.kind==='defend');defend.roleFilter=['gatherer'];defend.config.roomId='room-3';
  const run=await executable(graph);const selected=run.decide(context());assert.equal(selected.intents[0].type,'move');assert.equal(selected.memoryPatch.set.aiTrace.actors[0].moduleId,'defend');
  graph.nodes.find(n=>n.id==='gather-node').fallback='hold-node';const held=(await executable(graph)).decide(context());assert.deepEqual(held.intents,[]);assert.equal(held.memoryPatch.set.aiTrace.actors[0].selectedNodeId,'hold-node');
 }
});
test('invalid graph saves as draft while validated generation blocks preview/publication',()=>{
 const graph=api.createLogisticsGraph();graph.nodes.find(n=>n.id==='gather-node').fallback='cargo-check';
 const draft=api.serializeGraphDraft(graph);assert.ok(draft.files['graph-plan.ts']);assert.deepEqual(api.recoverRuleGraph(draft),graph);assert.throws(()=>api.toGraphSourceProject(graph),/acyclic/);
});
