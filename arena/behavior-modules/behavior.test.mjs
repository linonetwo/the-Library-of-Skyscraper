import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { build } from '../script-toolchain/node_modules/esbuild/lib/main.js';
import { compileRule } from '../script-toolchain/src/compile.mjs';
const built = await build({entryPoints:[new URL('./index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const api = await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const actor = {id:'a',owner:'p',role:'gatherer',roomId:'base',hp:100,maxHp:100,state:'idle',cargo:0,cargoCapacity:10};
const rooms=[{id:'base',kind:'base',q:0,r:0,resources:0,enemyHp:0,owner:'p'},{id:'resource',kind:'resource',q:1,r:0,resources:10,enemyHp:0,owner:null},{id:'site',kind:'ruins',q:2,r:0,resources:0,enemyHp:0,owner:null}];
const context=(patch={})=>({tick:7,player:{id:'p',materials:100},squad:{actors:[{...actor,...patch}]},world:{rooms,actors:[],buildings:[]},tasks:{items:[]},memory:{},limits:{maxIntents:10,maxMemoryBytes:16384,maxTaskPatches:10}});
async function executable(plan) {
  const project=api.toRuleSourceProject(plan);
  const compiled=await compileRule(project);
  assert.deepEqual(compiled.diagnostics,[]);
  return {project,compiled,decide(ctx){const sandbox=vm.createContext({});vm.runInContext(compiled.bundle.code,sandbox);return JSON.parse(JSON.stringify(sandbox.__arenaRule.decide(ctx)));}};
}
test('canonical generated project roundtrip refuses edited or additional source',()=>{
 const plan=api.createDefaultBehaviorPlan();const project=api.toRuleSourceProject(plan);
 assert.deepEqual(api.recoverBehaviorPlan(project),plan);
 for (const module of plan.modules) {const ref=api.getModuleSourceRef(project,module.moduleId);assert.ok(project.files[ref.file].split('\n')[ref.line-1].includes('"moduleId":"'+module.moduleId+'"'));}
 const hold=api.getModuleSourceRef(project,'hold');assert.ok(project.files[hold.file].split('\n')[hold.line-1].includes("moduleId:'hold'"));
 assert.equal(api.recoverBehaviorPlan({...project,files:{...project.files,'main.ts':project.files['main.ts']+'// manual'}}),null);
 assert.equal(api.recoverBehaviorPlan({...project,files:{...project.files,'extra.ts':''}}),null);
});
test('official modules compile and execute in V8 with priority, roles, hold and parameter changes',async()=>{
 const plan=api.createDefaultBehaviorPlan();let run=await executable(plan);
 assert.equal(run.decide(context()).intents[0].roomId,'resource');
 assert.equal(run.decide(context({hp:20})).memoryPatch.set.aiTrace.actors[0].moduleId,'retreat');
 assert.deepEqual(run.decide(context({hp:20})).intents,[]);
 assert.equal(run.decide(context({cargo:4,roomId:'resource'})).intents[0].roomId,'base');
 assert.equal(run.decide(context({role:'scout'})).memoryPatch.set.aiTrace.actors[0].moduleId,'hold');
 assert.deepEqual(run.decide(context({travel:{targetRoomId:'resource'}})).intents,[]);
 plan.modules.find(m=>m.kind==='haul').config.minCargo=6;
 let changed=await executable(plan);
 assert.notEqual(run.compiled.bundle.sourceHash,changed.compiled.bundle.sourceHash);
 assert.equal(changed.decide(context({cargo:4,roomId:'resource'})).intents[0].type,'gather');
});
test('build starts construction once and leaves running authority task intact',async()=>{
 const plan=api.createDefaultBehaviorPlan();const module=plan.modules.find(m=>m.kind==='build');module.enabled=true;module.config.roomId='site';
 const run=await executable(plan);
 assert.equal(run.decide(context({roomId:'site'})).intents[0].type,'build');
 const ongoing=context({roomId:'site',task:{kind:'build',target:'site',stage:'construct',buildingKind:'catalog'}});ongoing.world.buildings=[{owner:'p',roomId:'site',kind:'catalog',hp:100,constructionTicks:1,requiredTicks:8}];ongoing.memory={aiTrace:{actors:[{actorId:'a',moduleId:'build'}]}};
 const running=run.decide(ongoing);
 assert.deepEqual(running.intents,[]);assert.equal(running.memoryPatch.set.aiTrace.actors[0].moduleId,'build');
 const ctx=context({roomId:'site'});ctx.world.buildings=[{owner:'p',roomId:'site',kind:'catalog',hp:100,constructionTicks:8,requiredTicks:8}];
 assert.equal(run.decide(ctx).memoryPatch.set.aiTrace.actors[0].moduleId,'gather');
});
test('ties follow array order; disabled and roles are excluded; movement follows adjacent rooms',async()=>{
 const plan=api.createDefaultBehaviorPlan();plan.modules=plan.modules.filter(m=>m.kind==='gather'||m.kind==='defend');
 const defend=plan.modules.find(m=>m.kind==='defend');defend.roleFilter=['gatherer'];defend.config.roomId='site';defend.priority=20;
 const run=await executable(plan);assert.equal(run.decide(context()).memoryPatch.set.aiTrace.actors[0].moduleId,'defend');
 assert.equal(run.decide(context()).intents[0].roomId,'resource');
 defend.enabled=false;assert.equal((await executable(plan)).decide(context()).memoryPatch.set.aiTrace.actors[0].moduleId,'gather');
});
test('generated project uses authority compiler and independent V8 worker', {skip:!process.env.ARENA_MODULE_TEST_URL}, async()=>{
 const base=process.env.ARENA_MODULE_TEST_URL;
 async function request(path,body,token) {const res=await fetch(base+'/api/sessions'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await res.json();assert.equal(res.ok,true,JSON.stringify(data));return data;}
 const session=await request('',{mode:'training',seed:42});
 const path='/'+session.sessionId;
 const project=api.toRuleSourceProject(api.createDefaultBehaviorPlan());
 const preview=await request(path+'/scripts/preview',project,session.token);
 assert.deepEqual(preview.compilation.diagnostics,[]);
 assert.ok(preview.execution.decision,JSON.stringify(preview));
 assert.equal(preview.execution.decision.memoryPatch.set.aiTrace.v,1);
 assert.ok(preview.execution.decision.intents.length>0);
 await request(path+'/scripts/publish',project,session.token);
 const snapshot=await request(path+'/commands',{type:'step',ticks:20},session.token);
 assert.ok(snapshot.actors.some(a=>a.travel || a.cargo>0 || a.state!=='idle'));
 console.log('authority behavior observation', JSON.stringify({tick:snapshot.tick,actors:snapshot.actors.map(a=>({id:a.id,state:a.state,cargo:a.cargo,travel:!!a.travel}))}));
 const state=await request(path+'/scripts/state',undefined,session.token);
 assert.equal(state.memory.aiTrace.v,1);
 assert.ok(state.memory.aiTrace.tick>0);
});
test('defend establishes guard pursuit, respects range and cooldown, then holds catalog',async()=>{
 const plan=api.createFirstExpeditionPlan();const run=await executable(plan);
 const ctx=context({role:'guard',roomId:'site',worldPosition:{x:0,y:0},actionTick:0});
 ctx.world.rooms=ctx.world.rooms.map(r=>r.id==='site'?{...r,id:'room-3',enemyHp:20}:r);ctx.squad.actors[0].roomId='room-3';
 ctx.world.enemies=[{id:'e',roomId:'room-3',hp:20,worldPosition:{x:10,y:0}}];
 ctx.world.scenarioConfig={attackRange:2,combatIntervalTicks:4};
 assert.equal(run.decide(ctx).intents[0].type,'capture');
 ctx.squad.actors[0].task={kind:'guard',target:'room-3',stage:'guarding'};
 assert.deepEqual(run.decide(ctx).intents,[]);assert.match(run.decide(ctx).memoryPatch.set.aiTrace.actors[0].reason,/approaching/);
 ctx.world.enemies[0].worldPosition.x=1;assert.equal(run.decide(ctx).intents[0].type,'attack');
 ctx.squad.actors[0].actionTick=6;assert.deepEqual(run.decide(ctx).intents,[]);
 ctx.world.enemies=[];ctx.world.rooms.find(r=>r.id==='room-3').enemyHp=0;
 assert.deepEqual(run.decide(ctx).intents,[]);assert.match(run.decide(ctx).memoryPatch.set.aiTrace.actors[0].reason,/holding/);
});
test('first expedition seed42 damages guardians, deposits materials and completes catalog', {skip:!process.env.ARENA_MODULE_TEST_URL}, async()=>{
 let session;
 async function request(path,body) {const res=await fetch(process.env.ARENA_MODULE_TEST_URL+'/api/sessions'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(session?{authorization:'Bearer '+session.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await res.json();assert.equal(res.ok,true,JSON.stringify(data));return data;}
 session=await request('',{mode:'training',seed:42});const path='/'+session.sessionId;
 await request(path+'/commands',{type:'pause',paused:true});
 const initial=await request(path+'/state');
 const published=await request(path+'/scripts/publish',api.toRuleSourceProject(api.createFirstExpeditionPlan()));assert.deepEqual(published.compilation.diagnostics,[]);
 let damage=false,deposit=false,construction=false,cataloging=false,snapshot;
 for(let i=0;i<16;i++) {
  snapshot=await request(path+'/commands',{type:'step',ticks:20});
  damage ||= snapshot.enemies.some(enemy=>enemy.hp<(initial.enemies.find(e=>e.id===enemy.id)?.hp??enemy.hp));
  deposit ||= snapshot.players[0].materials>initial.players[0].materials;
  construction ||= snapshot.buildings.some(b=>b.kind==='catalog' && b.constructionTicks>0);
  cataloging ||= snapshot.actors.some(a=>a.role==='scout' && a.task?.stage==='cataloging');
  if(snapshot.result)break;
 }
 assert.equal(snapshot.result?.winner,'p1');assert.match(snapshot.result.reason,/远征胜利/);
 assert.ok(damage,'guardian HP decreased');assert.ok(deposit,'materials deposited');assert.ok(construction,'catalog construction advanced');assert.ok(cataloging,'scout guards completed catalog');
 console.log('first expedition authoritative result',JSON.stringify({tick:snapshot.tick,damage,deposit,construction,cataloging,result:snapshot.result}));
});

test('archived PR77 runtime stays read-only but resolves its own module source lines',async()=>{
 const project=JSON.parse(await readFile(new URL('./fixtures/pr77-project.json',import.meta.url),'utf8'));
 assert.equal(api.recoverBehaviorPlan(project),null);
 const compiled=await compileRule(project);assert.deepEqual(compiled.diagnostics,[]);
 for(const id of ['gather','haul','build','defend','retreat','hold']) {
  const ref=api.getModuleSourceRef(project,id);assert.ok(ref,id);assert.ok(ref.line>0);
  assert.ok(project.files[ref.file].split('\n')[ref.line-1].includes(id));
 }
 const mismatch=structuredClone(project);mismatch.files['ai-plan.ts']=mismatch.files['ai-plan.ts'].replace('"hpThreshold":30}', '"hpThreshold":31}');
 assert.equal(api.getModuleSourceRef(mismatch,'retreat'),null);
 const handwritten=structuredClone(project);handwritten.files['main.ts']='export function decide(){return {intents:[]}}';
 assert.equal(api.getModuleSourceRef(handwritten,'gather'),null);
});
