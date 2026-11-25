import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';
import { build } from '../../script-toolchain/node_modules/esbuild/lib/main.js';
import { compileRule } from '../../script-toolchain/src/compile.mjs';
const built=await build({entryPoints:[new URL('./index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const legacy=JSON.parse(readFileSync(new URL('./fixtures/v040-logistics-project.json',import.meta.url)));
const graph=action=>({schemaVersion:2,graphId:'mobility-check',revision:0,roles:[{id:'role',role:'guard',initialStateId:'support',fallbackStateId:'support'}],states:[{id:'support',name:'支援',treeId:'shortcut',entry:[],exit:[]}],transitions:[],modules:[],nodes:[{id:'shortcut',type:'mobility',action,priority:50,fallback:'hold'},{id:'hold',type:'hold',reason:'unavailable'}]});
const context=(actorPatch={},mapPatch={})=>({tick:10,player:{id:'p',materials:10},squad:{actors:[{id:'guard',owner:'p',role:'guard',roomId:'room-1',hp:100,cargo:0,cargoCapacity:24,...actorPatch}]},world:{rooms:[{id:'room-0',kind:'base'},{id:'room-1',kind:'resource',resources:100,enemyHp:0},{id:'room-2',kind:'resource'},{id:'room-3',kind:'catalog'}],actors:[],buildings:[],worldMap:{version:'library-v5.0',links:[{from:'room-1',to:'room-0'},{from:'room-0',to:'room-3'}],mobilityEdges:[{edgeId:'jump-1-2',kind:'jump',fromRoomId:'room-1',toRoomId:'room-2',segments:[],landingRadiusMilli:400},{edgeId:'climb-1-3',kind:'climb',fromRoomId:'room-1',toRoomId:'room-3',segments:[],landingRadiusMilli:400}],...mapPatch}},tasks:{items:[]},memory:{},limits:{maxIntents:1,maxTaskPatches:5,maxMemoryBytes:16384}});
async function compile(g){const project=api.toGraphSourceProject(g);const result=await compileRule(project);assert.deepEqual(result.diagnostics,[]);return {project,bundle:result.bundle};}
const evaluate=(bundle,ctx)=>{const sandbox=vm.createContext({});vm.runInContext(bundle.code,sandbox);return JSON.parse(JSON.stringify(sandbox.__arenaRule.decide(ctx)));};
test('v0.4 complete generated project stays byte-identical, editable and source-locatable',async()=>{
 assert.deepEqual(api.toGraphSourceProject(api.createLogisticsGraph()),legacy);
 assert.deepEqual(api.recoverRuleGraph(legacy),api.createLogisticsGraph());
 const changed=structuredClone(legacy);changed.files['graph-runtime.ts']+='\n// handwritten change\n';assert.equal(api.recoverRuleGraph(changed),null);
 assert.equal(api.recoverRuleGraph({files:{'main.ts':'export function decide(){return {intents:[]}}'}}),null);
 assert.ok(api.getGraphSourceRef(legacy,'cargo-check'));assert.equal(api.getGraphSourceRef(legacy,'cargo-check').file,'graph-plan.ts');
 const old=await compileRule(legacy);assert.deepEqual(old.diagnostics,[]);assert.equal(evaluate(old.bundle,context({role:'gatherer',cargo:7})).intents[0].type,'gather');
});
test('mobility graph emits typed single intents, preserves native trace/source and active travel',async()=>{
 for(const action of [{type:'run',viaRoomId:'room-0',roomId:'room-3'},{type:'jump',edgeId:'jump-1-2'},{type:'climb',edgeId:'climb-1-3'}]){
  const g=graph(action);const {project,bundle}=await compile(g);assert.ok(project.files['mobility-runtime.ts']);assert.deepEqual(api.recoverRuleGraph(project),g);
  const result=evaluate(bundle,context());assert.deepEqual(result.intents,[{...action,actorId:'guard',priority:50}]);assert.equal(result.memoryPatch.set.aiTrace.actors[0].selectedNodeId,'shortcut');assert.equal(result.memoryPatch.set.aiTrace.v,2);
  const ref=api.getGraphSourceRef(project,'shortcut');assert.match(project.files[ref.file].split('\n')[ref.line-1],/"id":"shortcut"/);
  const inFlight=evaluate(bundle,context({travel:{travelId:'original',targetRoomId:'room-3'},locomotion:{kind:'climb',phase:'grip',progress:.4}}));assert.deepEqual(inFlight.intents,[]);assert.equal(inFlight.memoryPatch.set.aiTrace.actors[0].selectedNodeId,'shortcut');assert.match(inFlight.memoryPatch.set.aiTrace.actors[0].reason,/in progress.*grip/);
 }
});
test('static malformed mobility diagnoses, unavailable runtime endpoints take original fallback',async()=>{
 const invalid=graph({type:'run',viaRoomId:'room-3',roomId:'room-3'});assert.ok(api.diagnoseGraph(invalid).some(d=>d.code==='mobility'&&d.objectId==='shortcut'));assert.throws(()=>api.toGraphSourceProject(invalid));
 for(const action of [{type:'jump',edgeId:'unknown'},{type:'climb',edgeId:'jump-1-2'},{type:'run',viaRoomId:'unknown',roomId:'room-3'}]){
  const {bundle}=await compile(graph(action));const decision=evaluate(bundle,context());assert.deepEqual(decision.intents,[]);assert.equal(decision.memoryPatch.set.aiTrace.actors[0].selectedNodeId,'hold');
 }
 const {bundle}=await compile(graph({type:'jump',edgeId:'jump-1-2'}));assert.deepEqual(evaluate(bundle,context({roomId:'room-0'})).intents,[]);
 assert.deepEqual(evaluate(bundle,context({}, {mobilityEdges:undefined})).intents,[]);
 const run=await compile(graph({type:'run',viaRoomId:'room-0',roomId:'room-3'}));assert.deepEqual(evaluate(run.bundle,context({}, {links:[{from:'room-1',to:'room-0'},{from:'room-0',to:'room-3'},{from:'room-1',to:'room-3'}]})).intents,[]);
});
test('mobility fallback IDs participate in shared rename/copy and cycle diagnostics',()=>{
 const original=graph({type:'jump',edgeId:'jump-1-2'});const renamed=api.applyGraphPatch(original,api.renameGraphObject(original,'hold','other-hold'));assert.equal(renamed.nodes[0].fallback,'other-hold');const copy=api.cloneGraphFragment(original,'shortcut');const copied=api.applyGraphPatch(original,copy.patch);assert.equal(copied.nodes.find(n=>n.id===copy.rootId).fallback,copy.idMap.hold);original.nodes[0].fallback='shortcut';assert.ok(api.diagnoseGraph(original).some(d=>d.code==='tree-cycle'));
});
test('three generated actions execute in the production independent V8 runner', {skip:!process.env.ARENA_SCRIPT_RUNNER},async()=>{
 for(const action of [{type:'run',viaRoomId:'room-0',roomId:'room-3'},{type:'jump',edgeId:'jump-1-2'},{type:'climb',edgeId:'climb-1-3'}]){
  const {bundle}=await compile(graph(action));const output=spawnSync(process.env.ARENA_SCRIPT_RUNNER,[],{input:JSON.stringify({bundle,context:context()})+'\n',encoding:'utf8'});assert.equal(output.status,0,output.stderr);const result=JSON.parse(output.stdout);assert.equal(result.failure,undefined,JSON.stringify(result));assert.deepEqual(result.decision.intents,[{...action,actorId:'guard',priority:50}]);assert.equal(result.decision.memoryPatch.set.aiTrace.actors[0].selectedNodeId,'shortcut');
 }
});
test('shortcut support example keeps the five official modules and hands arrival back to work',async()=>{
 const g=api.createShortcutSupportGraph();assert.equal(g.modules.length,5);assert.deepEqual(api.diagnoseGraph(g).filter(d=>d.severity==='error'),[]);
 const {bundle}=await compile(g);const ctx=context();ctx.world.worldMap.mobilityEdges=[{edgeId:'jump-room-1-room-2',kind:'jump',fromRoomId:'room-1',toRoomId:'room-2',segments:[],landingRadiusMilli:400},{edgeId:'climb-room-4-room-3',kind:'climb',fromRoomId:'room-4',toRoomId:'room-3',segments:[],landingRadiusMilli:400}];
 assert.equal(evaluate(bundle,ctx).intents[0].type,'run');
 ctx.squad.actors[0].role='gatherer';assert.equal(evaluate(bundle,ctx).intents[0].type,'jump');
 ctx.squad.actors[0].roomId='room-2';ctx.world.rooms.find(r=>r.id==='room-2').resources=100;assert.equal(evaluate(bundle,ctx).intents[0].type,'gather');
 ctx.squad.actors[0].role='scout';ctx.squad.actors[0].roomId='room-4';assert.equal(evaluate(bundle,ctx).intents[0].type,'climb');
});
