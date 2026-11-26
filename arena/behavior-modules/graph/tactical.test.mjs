import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {build} from '../../script-toolchain/node_modules/esbuild/lib/main.js';
import {compileRule} from '../../script-toolchain/src/compile.mjs';
const built=await build({entryPoints:[new URL('./index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const runner=process.env.ARENA_SCRIPT_RUNNER;
const actor={id:'guard',owner:'p',role:'guard',roomId:'room-3',hp:100,maxHp:100,cargo:0,cargoCapacity:24};
const enemy=(id,hp=80)=>({id,roomId:'room-3',hp,maxHp:80,worldPosition:{x:0,y:0},state:'guarding'});
const building=(id,owner='p',hp=50,maxHp=100)=>({id,owner,roomId:'room-3',hp,maxHp,constructionTicks:5,requiredTicks:5,worldPosition:{x:0,y:0}});
function ctx(){return {tick:10,player:{id:'p',materials:3},squad:{actors:[structuredClone(actor)]},world:{rooms:[{id:'room-0',kind:'base',q:0,r:0,owner:'p',enemyHp:0},{id:'room-3',kind:'ruins',q:1,r:0,owner:null,enemyHp:160},{id:'room-2',kind:'control',q:0,r:1,owner:null,enemyHp:0}],actors:[],buildings:[building('facility')],enemies:[enemy('enemy-a'),enemy('enemy-b')],tactics:{actorStates:[{actorId:'guard',weapon:'staff',energy:3,maxEnergy:3,castReadyTick:0}],controlPoints:[{roomId:'room-2',progressTicks:2,requiredTicks:6,contested:false}]}},tasks:{items:[]},memory:{},limits:{maxIntents:8,maxTaskPatches:8,maxMemoryBytes:32768}};}
function graph(module){return {schemaVersion:2,graphId:'tactics',revision:0,roles:[{id:'role',role:'guard',initialStateId:'state',fallbackStateId:'state'}],states:[{id:'state',name:'tactics',treeId:'request',entry:[],exit:[]}],transitions:[],nodes:[{id:'request',type:'module',moduleId:module.moduleId,fallback:'hold'},{id:'hold',type:'hold',reason:'fallback'}],modules:[module]};}
async function compile(g){const project=api.toGraphSourceProject(g),compiled=await compileRule(project);assert.deepEqual(compiled.diagnostics,[]);return {project,...compiled};}
async function execute(g,context){const {bundle}=await compile(g);const result=spawnSync(runner,[],{input:JSON.stringify({bundle,context})+'\n',encoding:'utf8'});assert.equal(result.status,0,result.stderr);const output=JSON.parse(result.stdout);assert.equal(output.failure,undefined,JSON.stringify(output));return output;}
const visit=output=>output.decision.memoryPatch.set.aiTrace.actors[0].moduleVisits[0];
test('four typed tactical instances compile; old graph project fixtures retain every byte',async()=>{
 for(const kind of api.TACTICAL_MODULE_KINDS)await compile(graph(api.createTacticalModule(kind,kind)));
 for(const file of ['v040-logistics-project.json','v050-shortcut-project.json','v060-composition-project.json']){
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/'+file,import.meta.url),'utf8'));
  const project=fixture.project??fixture;const recovered=api.recoverRuleGraph(project);assert.ok(recovered,file);assert.deepEqual(api.toGraphSourceProject(recovered),project,file);
 }
});
test('actual V8 preserves selected enemy IDs and original request facts', {skip:!runner},async()=>{
 const g=graph(api.createTacticalModule('attack','focus')),context=ctx();context.world.enemies=[enemy('b',4),enemy('a',4),enemy('lower',2),enemy('dead',0)];
 let out=await execute(g,context);assert.equal(out.decision.intents[0].targetId,'lower');assert.deepEqual(visit(out).observed,{hp:2,maxHp:80});assert.equal(visit(out).reasonCode,'attack-requested');
 g.modules[0].config.target={type:'enemy',enemyId:'b'};out=await execute(g,context);assert.equal(out.decision.intents[0].targetId,'b');
 g.modules[0].config.target={type:'enemy',enemyId:'gone'};out=await execute(g,context);assert.deepEqual(out.decision.intents,[]);assert.equal(visit(out).reasonCode,'target-missing');assert.equal(visit(out).resolvedId,undefined);assert.equal(visit(out).fallbackNodeId,'hold');
});
test('actual V8 repairs own completed damaged buildings by missing HP then stable ID', {skip:!runner},async()=>{
 const g=graph(api.createTacticalModule('repair','fix')),context=ctx();context.world.buildings=[building('other','enemy',1),building('full','p',100),{...building('unfinished','p',1),constructionTicks:1},building('b','p',20),building('a','p',20),building('percent','p',1,2)];
 const out=await execute(g,context);assert.equal(out.decision.intents[0].buildingId,'a');assert.deepEqual(visit(out).observed,{hp:20,maxHp:100,materials:3});assert.equal(visit(out).reasonCode,'repair-requested');
});
test('actual V8 follows room travel and holds active authority tasks without fabricating effects', {skip:!runner},async()=>{
 const g=graph(api.createTacticalModule('claim','point')),context=ctx();
 let out=await execute(g,context);assert.equal(out.decision.intents[0].type,'move');assert.equal(visit(out).reasonCode,'moving');
 context.squad.actors[0].roomId='room-2';out=await execute(g,context);assert.deepEqual(out.decision.intents,[{type:'claim',actorId:'guard',priority:20,roomId:'room-2'}]);
 context.squad.actors[0].task={kind:'claim',target:'room-2',stage:'claiming',blockedReason:null};out=await execute(g,context);assert.deepEqual(out.decision.intents,[]);assert.equal(visit(out).reasonCode,'claim-active');
 context.world.tactics=undefined;out=await execute(g,context);assert.equal(visit(out).reasonCode,'tactics-unavailable');assert.equal(visit(out).resolvedId,undefined);
});
test('same generated cast flows through actual native skill evidence; busy actor holds', {skip:!runner},async()=>{
 const g=graph(api.createTacticalModule('cast','ink')),context=ctx();
 let out=await execute(g,context);assert.equal(out.decision.intents[0].type,'cast');assert.equal(visit(out).reasonCode,'cast-requested');assert.equal(out.chants[0].intentIndex,0);assert.equal(out.chants[0].targetId,'enemy-a');assert.equal(out.chants[0].reasonCode,undefined);
 for(const [field,reason] of [['cast','cast-active'],['recovery','recovery-active']]){
  const busy=ctx();busy.world.enemies=[];busy.world.tactics.actorStates[0][field]={endsTick:14};out=await execute(g,busy);assert.deepEqual(out.decision.intents,[]);assert.equal(visit(out).reasonCode,reason);assert.equal(out.chants,undefined);
 }
});
test('fragments bind selector rooms; explicit skill handover archives its actual file',async()=>{
 const g=graph(api.createTacticalModule('cast','ink')),fragment=api.exportGraphFragment(g,'request');
 assert.deepEqual(api.graphFragmentRefs(fragment),[{type:'room',roomId:'room-3'}]);
 const inserted=api.importGraphFragment(g,fragment,{rooms:{'room-3':'room-2'},ownRoles:{}});assert.equal(inserted.patch.operations.find(op=>op.type==='putModule').module.config.target.roomId,'room-2');
 const {project,activeFile}=api.createInkStrikeSourceProject(g);assert.equal(activeFile,'skills/ink-strike.ts');assert.deepEqual((await compileRule(project)).diagnostics,[]);assert.equal(api.recoverRuleGraph(project),null);assert.equal(api.readArchivedRuleGraph(project).graphId,g.graphId);assert.deepEqual(api.getInkStrikeSourceRef(project),{file:activeFile,line:3,column:1});
 const arbitrary=structuredClone(project);arbitrary.files['main.ts']="export {decide} from './graph-runtime';\n";assert.equal(api.getInkStrikeSourceRef(arbitrary),null);
});
