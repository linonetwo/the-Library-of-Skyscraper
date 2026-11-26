import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';
import {build} from '../../script-toolchain/node_modules/esbuild/lib/main.js';
import {compileRule} from '../../script-toolchain/src/compile.mjs';
const built=await build({entryPoints:[new URL('./index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const module=(id,kind,config)=>({moduleId:id,kind,enabled:true,priority:20,config});
const graph=modules=>({schemaVersion:2,graphId:'composition-check',revision:0,roles:[{id:'g-role',role:'gatherer',initialStateId:'g-state',fallbackStateId:'g-state'},{id:'s-role',role:'scout',initialStateId:'s-state',fallbackStateId:'s-state'}],states:[{id:'g-state',name:'a',treeId:'first',entry:[],exit:[]},{id:'s-state',name:'b',treeId:'second',entry:[],exit:[]}],transitions:[],modules,nodes:[{id:'first',type:'module',moduleId:modules[0].moduleId,fallback:'fallback'},{id:'second',type:'module',moduleId:modules.at(-1).moduleId,fallback:'fallback'},{id:'fallback',type:'hold',reason:'fallback'}]});
const ref=roomId=>({type:'room',roomId});
const actor=(id,role,roomId='r0')=>({id,role,owner:'p',roomId,hp:100,cargo:8,cargoCapacity:24});
const context=(actors,tick=10,memory={})=>({tick,player:{id:'p',materials:10},squad:{actors},world:{rooms:[{id:'r0',kind:'base',q:0,r:0,enemyHp:0},{id:'r1',kind:'resource',q:1,r:0,enemyHp:0},{id:'r2',kind:'catalog',q:0,r:1,enemyHp:4}],actors:[],buildings:[]},tasks:{items:[]},memory,limits:{maxIntents:3,maxTaskPatches:5,maxMemoryBytes:16384}});
async function compile(g){const project=api.toGraphSourceProject(g);const compiled=await compileRule(project);assert.deepEqual(compiled.diagnostics,[]);return {project,...compiled};}
function native(bundle,ctx){if(!process.env.ARENA_SCRIPT_RUNNER){const sandbox=vm.createContext({});vm.runInContext(bundle.code,sandbox);return JSON.parse(JSON.stringify(sandbox.__arenaRule.decide(ctx)));}const output=spawnSync(process.env.ARENA_SCRIPT_RUNNER,[],{input:JSON.stringify({bundle,context:ctx})+'\n',encoding:'utf8'});assert.equal(output.status,0,output.stderr);const result=JSON.parse(output.stdout);assert.equal(result.failure,undefined,JSON.stringify(result));return result.decision;}
test('scout instances emit arrival/fallback evidence and preserve original draft recovery',async()=>{
 const g=graph([module('scout-home','scout',{target:ref('r0'),maxEnemyHp:0,reportIntervalTicks:3}),module('scout-risk','scout',{target:ref('r2'),maxEnemyHp:2,reportIntervalTicks:3})]);
 const {project,bundle}=await compile(g);const result=native(bundle,context([actor('g','gatherer'),actor('s','scout')]));
 assert.deepEqual(result.intents,[]);const [a,b]=result.memoryPatch.set.aiTrace.actors;
 assert.deepEqual(a.moduleVisits,[{nodeId:'first',moduleId:'scout-home',outcome:'hold',reasonCode:'scout-reported',ref:ref('r0'),resolvedId:'r0',observed:{tick:10,enemyHp:0}}]);
 assert.equal(b.moduleVisits[0].reasonCode,'risk-exceeded');assert.equal(b.moduleVisits[0].fallbackNodeId,'fallback');assert.equal(b.selectedNodeId,'fallback');
 assert.equal(result.memoryPatch.set.graphState.g.moduleState['scout-home'].reportedTick,10);assert.deepEqual(result.memoryPatch.set.graphState.s.moduleState['scout-risk'],{});
 assert.deepEqual(api.recoverRuleGraph(project),g);const manual=structuredClone(project);manual.files['main.ts']+='// manual\n';assert.equal(api.recoverRuleGraph(manual),null);assert.ok(api.getGraphSourceRef(project,'scout-home'));
 if(process.env.COMPOSITION_TRACE_OUTPUT)writeFileSync(process.env.COMPOSITION_TRACE_OUTPUT,JSON.stringify({sourceHash:bundle.sourceHash,owner:'p',tick:10,trace:result.memoryPatch.set.aiTrace},null,2));
});
test('patrol cursors are isolated per actor and instance and advance only after actual arrival/dwell',async()=>{
 const g=graph([module('patrol-a','patrol',{rooms:[ref('r0'),ref('r1')],dwellTicks:2}),module('patrol-b','patrol',{rooms:[ref('r1'),ref('r0')],dwellTicks:2})]);const {bundle}=await compile(g);
 const actors=[actor('a','gatherer'),actor('b','gatherer','r1'),actor('c','scout')];let result=native(bundle,context(actors));
 assert.deepEqual(result.intents.map(i=>[i.actorId,i.roomId]),[['b','r0'],['c','r1']]);
 result=native(bundle,context(actors,12,result.memoryPatch.set));assert.equal(result.memoryPatch.set.graphState.a.moduleState['patrol-a'].cursor,1);assert.equal(result.memoryPatch.set.graphState.b.moduleState['patrol-a'].cursor,undefined);assert.equal(result.memoryPatch.set.graphState.c.moduleState['patrol-b'].cursor,undefined);
 actors[0].travel={travelId:'t',targetRoomId:'r1'};result=native(bundle,context(actors,13,result.memoryPatch.set));assert.equal(result.memoryPatch.set.aiTrace.actors[0].moduleVisits[0].reasonCode,'travel-active');assert.ok(!result.intents.some(i=>i.actorId==='a'));
});
test('escort picks own living role by stable id and follows authority destination, missing target falls back',async()=>{
 const m=module('escort','escort',{target:{type:'ownRole',role:'gatherer'},minCargo:5});const {bundle}=await compile(graph([m]));const actors=[actor('s','scout'),actor('z','gatherer','r2'),actor('a','gatherer','r1')];actors[2].travel={targetRoomId:'r2'};
 let result=native(bundle,context(actors));assert.equal(result.intents.find(i=>i.actorId==='s').roomId,'r2');assert.equal(result.memoryPatch.set.aiTrace.actors[0].moduleVisits[0].resolvedId,'a');
 actors[2].hp=0;actors[1].owner='enemy';result=native(bundle,context(actors));assert.equal(result.memoryPatch.set.aiTrace.actors[0].moduleVisits[0].reasonCode,'escort-target-missing');
});
test('fragment imports remap IDs once and preserve shared instances with explicit room/role bindings',()=>{
 const m=module('shared','scout',{target:ref('r0'),maxEnemyHp:0,reportIntervalTicks:3});m.roleFilter=['gatherer'];const g=graph([m]);g.nodes.push({id:'pair',type:'priority',children:['first','second'],fallback:'fallback'});const fragment=api.exportGraphFragment(g,'pair');assert.equal(fragment.modules.length,1);
 assert.throws(()=>api.importGraphFragment(g,fragment,{rooms:{},ownRoles:{}}));const imported=api.importGraphFragment(g,fragment,{rooms:{r0:'r1'},ownRoles:{gatherer:'guard'}});const next=api.applyGraphPatch(g,imported.patch);assert.notEqual(imported.rootId,'pair');const copies=next.nodes.filter(n=>[imported.idMap.first,imported.idMap.second].includes(n.id));assert.equal(copies[0].moduleId,copies[1].moduleId);const copy=next.modules.find(m=>m.moduleId===copies[0].moduleId);assert.deepEqual(copy.config.target,ref('r1'));assert.deepEqual(copy.roleFilter,['guard']);assert.equal(next.revision,1);
});

test('v0.5 ordinary/mobility full files and archived source locations remain exact',()=>{
 for(const [file,create] of [['v040-logistics-project.json',api.createLogisticsGraph],['v050-shortcut-project.json',api.createShortcutSupportGraph]]){const archived=JSON.parse(readFileSync(new URL('./fixtures/'+file,import.meta.url)));assert.deepEqual(api.toGraphSourceProject(create()),archived);assert.deepEqual(api.recoverRuleGraph(archived),create());assert.ok(api.getGraphSourceRef(archived,create().nodes[0].id));}
});

test('composition executes through the independent production V8 runner',{skip:!process.env.ARENA_SCRIPT_RUNNER},async()=>{
 const g=graph([module('scout','scout',{target:ref('r0'),maxEnemyHp:0,reportIntervalTicks:3})]);const {bundle}=await compile(g);assert.equal(native(bundle,context([actor('s','scout')])).memoryPatch.set.aiTrace.actors[0].moduleVisits[0].reasonCode,'scout-reported');
});
test('mixed graphs record old-card fallback before new choice and explicitly truncate actual visits',async()=>{
 const g=graph([module('old','gather',{targetRoomId:'missing'}),module('new','scout',{target:ref('r0'),maxEnemyHp:0,reportIntervalTicks:3})]);g.nodes[0].fallback='second';
 let {bundle}=await compile(g);let result=native(bundle,context([actor('g','gatherer')]));let visits=result.memoryPatch.set.aiTrace.actors[0].moduleVisits;
 assert.deepEqual(visits.map(v=>[v.moduleId,v.outcome,v.reasonCode]),[['old','fallback','official-unavailable'],['new','hold','scout-reported']]);
 const modules=Array.from({length:10},(_,i)=>module('scout-'+i,'scout',{target:ref('r0'),maxEnemyHp:0,reportIntervalTicks:3}));const many=graph(modules);many.nodes=[{id:'first',type:'sequence',children:modules.map(m=>'node-'+m.moduleId),fallback:'fallback'},...modules.map(m=>({id:'node-'+m.moduleId,type:'module',moduleId:m.moduleId,fallback:'fallback'})),{id:'second',type:'hold',reason:'none'},{id:'fallback',type:'hold',reason:'fallback'}];
 ({bundle}=await compile(many));result=native(bundle,context([actor('g','gatherer')]));const trace=result.memoryPatch.set.aiTrace.actors[0];assert.equal(trace.moduleVisits.length,8);assert.equal(trace.moduleVisitsTruncated,true);assert.equal(trace.visited.filter(v=>v.nodeId.startsWith('node-')).length,10);assert.deepEqual(result.intents,[]);
});
test('missing rooms/filtered modules fall back and physically unfinished scout does not report',async()=>{
 const g=graph([module('scout','scout',{target:ref('missing'),maxEnemyHp:0,reportIntervalTicks:3})]);let {bundle}=await compile(g);let result=native(bundle,context([actor('g','gatherer')]));assert.equal(result.memoryPatch.set.aiTrace.actors[0].moduleVisits[0].reasonCode,'room-missing');
 g.modules[0].config.target=ref('r1');({bundle}=await compile(g));const a=actor('g','gatherer');a.travel={travelId:'real',targetRoomId:'r1'};result=native(bundle,context([a]));assert.equal(result.memoryPatch.set.graphState.g.moduleState.scout.reportedTick,undefined);assert.equal(result.memoryPatch.set.aiTrace.actors[0].moduleVisits[0].reasonCode,'travel-active');
 g.modules[0].roleFilter=['guard'];({bundle}=await compile(g));result=native(bundle,context([a]));assert.equal(result.memoryPatch.set.aiTrace.actors[0].moduleVisits[0].reasonCode,'role-filtered');
 g.modules[0].config.reportIntervalTicks=-1;assert.ok(api.diagnoseGraph(g).some(d=>d.code==='module-config'));assert.throws(()=>api.toGraphSourceProject(g));
});
test('escort same-room defense reuses the original guard action and safe rooms hold',async()=>{
 const g=graph([module('escort','escort',{target:{type:'ownRole',role:'gatherer'},minCargo:5})]);const {bundle}=await compile(g);const s=actor('s','scout','r2'),a=actor('a','gatherer','r2');let result=native(bundle,context([s,a]));assert.deepEqual(result.intents.find(i=>i.actorId==='s'),{type:'capture',actorId:'s',priority:20});
 s.roomId='r0';a.roomId='r0';result=native(bundle,context([s,a]));assert.ok(!result.intents.some(i=>i.actorId==='s'));assert.equal(result.memoryPatch.set.aiTrace.actors[0].moduleVisits[0].reasonCode,'escort-safe');
});
test('composition example retains official work/retreat and emits one action per actor',async()=>{
 const g=api.createCompositionGraph();assert.deepEqual(api.diagnoseGraph(g).filter(d=>d.severity==='error'),[]);const {project,bundle}=await compile(g);const ctx=context([actor('g','gatherer','room-1'),actor('s','scout','room-0'),actor('d','guard','room-0')]);ctx.squad.actors[0].cargo=10;ctx.world.rooms=[{id:'room-0',kind:'base',q:0,r:0,enemyHp:0},{id:'room-1',kind:'resource',q:1,r:0,enemyHp:0,resources:100},{id:'room-3',kind:'catalog',q:0,r:1,enemyHp:60}];const result=native(bundle,ctx);assert.equal(new Set(result.intents.map(i=>i.actorId)).size,result.intents.length);assert.deepEqual(api.recoverRuleGraph(project),g);assert.equal(result.memoryPatch.set.aiTrace.actors.find(a=>a.actorId==='s').moduleVisits[0].reasonCode,'risk-exceeded');
});
