import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {build} from '../../script-toolchain/node_modules/esbuild/lib/main.js';
import {compileRule} from '../../script-toolchain/src/compile.mjs';
const built=await build({entryPoints:[new URL('./index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node'});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const actor=(id,role='gatherer',cargo=0)=>({id,role,owner:'p',roomId:'room-1',hp:100,maxHp:100,cargo,cargoCapacity:24});
const context=(actors,tick=10,memory={})=>({tick,player:{id:'p',materials:10},squad:{actors},world:{rooms:[{id:'room-0',kind:'base',q:0,r:0,enemyHp:0},{id:'room-1',kind:'resource',q:1,r:0,enemyHp:0,resources:100}],actors:[],buildings:[]},tasks:{items:[]},memory,limits:{maxIntents:8,maxTaskPatches:8,maxMemoryBytes:32768}});
async function example(){
 const definition=await api.saveCustomModuleDefinition(api.createCustomModuleDraft('player-gather'));
 let graph={schemaVersion:2,graphId:'custom-example',revision:0,roles:[{id:'g-role',role:'gatherer',initialStateId:'g-state',fallbackStateId:'g-state'},{id:'s-role',role:'scout',initialStateId:'s-state',fallbackStateId:'s-state'}],states:[{id:'g-state',name:'cargo4',treeId:'first',entry:[],exit:[]},{id:'s-state',name:'cargo8',treeId:'second',entry:[],exit:[]}],nodes:[{id:'first',type:'module',moduleId:'custom-a',fallback:'hold',exits:{bagFull:'deliver'}},{id:'second',type:'module',moduleId:'custom-b',fallback:'hold',exits:{bagFull:'hold'}},{id:'deliver',type:'module',moduleId:'haul',fallback:'hold'},{id:'hold',type:'hold',reason:'fallback'}],transitions:[],modules:[{moduleId:'haul',kind:'haul',enabled:true,priority:15,config:{minCargo:1}}]};
 for(const id of ['custom-a','custom-b'])graph=api.applyGraphPatch(graph,api.addCustomModule(graph,definition,id));
 graph.modules.find(m=>m.moduleId==='custom-b').config.limit=8;
 return {graph,definition};
}
async function compile(graph){const project=api.toGraphSourceProject(graph);const result=await compileRule(project);assert.deepEqual(result.diagnostics,[]);return {project,...result};}
function execute(bundle,ctx){
 if(!process.env.ARENA_SCRIPT_RUNNER){const sandbox=vm.createContext({});vm.runInContext(bundle.code,sandbox);return JSON.parse(JSON.stringify(sandbox.__arenaRule.decide(ctx)));}
 const output=spawnSync(process.env.ARENA_SCRIPT_RUNNER,[],{input:JSON.stringify({bundle,context:ctx})+'\n',encoding:'utf8'});
 assert.equal(output.status,0,output.stderr);const result=JSON.parse(output.stdout);assert.equal(result.failure,undefined,JSON.stringify(result));return result.decision;
}
const visits=(result,id)=>result.memoryPatch.set.aiTrace.actors.find(a=>a.actorId===id).moduleVisits;
test('custom editor packs exact author text and typed fields/exits; revisions are immutable content hashes',async()=>{
 const draft=api.createCustomModuleDraft('my-kind'),definition=await api.saveCustomModuleDefinition(draft);
 assert.match(definition.revisionId,/^[a-f0-9]{64}$/);assert.deepEqual(await api.saveCustomModuleDefinition(structuredClone(draft)),definition);
 const editor=api.customModuleEditorProject(draft);assert.equal(editor.project.files[editor.activeFile],draft.source);assert.deepEqual((await compileRule(editor.project)).diagnostics,[]);
 const bad=structuredClone(draft);bad.fields[0].default=3.5;bad.fields.push({...bad.fields[0]});bad.exits.push({...bad.exits[0]});
 assert.deepEqual(new Set(api.diagnoseCustomModule(bad).map(d=>d.code)),new Set(['field-default','field-key','exit-key']));
 const {graph}=await example();assert.throws(()=>api.applyGraphPatch(graph,{graphId:graph.graphId,baseRevision:graph.revision,operations:[{type:'putCustomDefinition',definition:{...graph.customDefinitions[0],source:'changed'}}]}),/immutable/);
});
test('two instances choose different actual actions at cargo4; ports are leaf-local and one outer decide runs all bodies',async()=>{
 const {graph,definition}=await example();const {project,bundle}=await compile(graph);const result=execute(bundle,context([actor('g','gatherer',4),actor('s','scout',4)]));
 assert.equal(result.intents.find(i=>i.actorId==='g').type,'move');assert.equal(result.intents.find(i=>i.actorId==='g').roomId,'room-0');
 assert.deepEqual(result.intents.find(i=>i.actorId==='s'),{type:'gather',actorId:'s',priority:20});
 assert.deepEqual(visits(result,'g')[0],{moduleId:'custom-a',nodeId:'first',outcome:'fallback',reasonCode:'custom-exit',fallbackNodeId:'deliver',exitKey:'bagFull',reason:'货量达到返仓阈值'});
 assert.equal(visits(result,'s')[0].reasonCode,'custom-selected');
 assert.equal(project.files[`custom/${definition.revisionId}/body.ts`],definition.source);
 assert.deepEqual(api.recoverRuleGraph(project),graph);
 if(process.env.CUSTOM_TRACE_OUTPUT)writeFileSync(process.env.CUSTOM_TRACE_OUTPUT,JSON.stringify({project,bundle:{sourceHash:bundle.sourceHash},context:context([actor('g','gatherer',4),actor('s','scout',4)]),decision:result},null,2));
});
test('shared instance memory is actor-local, previous-tick based on repeated visits, and last explicit write commits once',async()=>{
 const {graph}=await example();const draft=api.createCustomModuleDraft('memory-kind');draft.exits=[{key:'again',label:'next'}];
 draft.source="import type {Input,Result} from './types';\nexport function decide(input:Input):Result {const old=(input.memory??{}) as {count?:number};return {type:'exit',key:'again',reason:'count',memory:{count:(old.count??0)+1}};}\n";
 const definition=await api.saveCustomModuleDefinition(draft);graph.customDefinitions=[definition];
 graph.modules=graph.modules.filter(m=>m.kind==='custom').map(m=>({...m,definitionId:definition.definitionId,revisionId:definition.revisionId}));
 graph.nodes=graph.nodes.filter(n=>n.id!=='deliver');graph.nodes[0].exits={again:'second'};graph.nodes[1].moduleId='custom-a';graph.nodes[1].exits={again:'hold'};
 const {bundle}=await compile(graph);let result=execute(bundle,context([actor('g'),actor('s','scout')]));
 assert.equal(visits(result,'g').length,2);assert.equal(result.memoryPatch.set.graphState.g.customState['custom-a'].count,1);assert.equal(result.memoryPatch.set.graphState.s.customState['custom-a'].count,1);
 result.memoryPatch.set.graphState.s.customState['custom-a'].count=8;
 result=execute(bundle,context([actor('g'),actor('s','scout')],11,result.memoryPatch.set));
 assert.equal(result.memoryPatch.set.graphState.g.customState['custom-a'].count,2);assert.equal(result.memoryPatch.set.graphState.s.customState['custom-a'].count,9);
});
test('unconnected named exits use fallback; diagnostics include named edges and cycles',async()=>{
 const {graph}=await example();delete graph.nodes[0].exits;const {bundle}=await compile(graph);const result=execute(bundle,context([actor('g','gatherer',4)]));
 assert.equal(visits(result,'g')[0].reasonCode,'custom-unconnected-exit');assert.equal(visits(result,'g')[0].fallbackNodeId,'hold');
 graph.nodes[0].exits={bagFull:'second'};graph.nodes[1].exits={bagFull:'first'};assert.ok(api.diagnoseGraph(graph).some(d=>d.code==='tree-cycle'));
 graph.nodes[0].exits={bad:'missing'};assert.ok(api.diagnoseGraph(graph).some(d=>d.code==='custom-exit'));assert.ok(api.diagnoseGraph(graph).some(d=>d.code==='reference'));
});
test('fixed fallback cannot be redirected by a connected named exit and needs no declared ports',async()=>{
 const {graph}=await example();graph.modules.find(m=>m.moduleId==='custom-a').config.resourceRoom={type:'room',roomId:'missing'};
 let {bundle}=await compile(graph);let result=execute(bundle,context([actor('g','gatherer',1)]));
 assert.deepEqual(visits(result,'g')[0],{moduleId:'custom-a',nodeId:'first',outcome:'fallback',reasonCode:'custom-fallback',fallbackNodeId:'hold',reason:'采集房间不可用，走后备'});
 assert.equal(result.memoryPatch.set.aiTrace.actors[0].selectedNodeId,'hold');assert.deepEqual(result.intents,[]);
 const draft=api.createCustomModuleDraft('zero-exits');draft.exits=[];draft.source="import type {Input,Result} from './types';\nexport function decide(input:Input):Result{return {type:'fallback',reason:'original fallback'};}\n";
 const definition=await api.saveCustomModuleDefinition(draft);graph.customDefinitions=[definition];
 for(const module of graph.modules)if(module.kind==='custom'){module.definitionId=definition.definitionId;module.revisionId=definition.revisionId;}
 for(const node of graph.nodes)if(node.type==='module'&&node.moduleId.startsWith('custom-'))delete node.exits;
 ({bundle}=await compile(graph));result=execute(bundle,context([actor('g')]));assert.equal(visits(result,'g')[0].reasonCode,'custom-fallback');assert.equal(visits(result,'g')[0].exitKey,undefined);
});
test('revisited instances read the old snapshot and commit only their last explicit memory result',async()=>{
 for(const omitSecond of [false,true]){
  const {graph}=await example();const draft=api.createCustomModuleDraft('last-write');draft.exits=[{key:'again',label:'again'}];
  draft.source=`import type {Input,Result} from './types';\nlet calls=0;\nexport function decide(input:Input):Result {calls++;const seen=(input.memory as {value:number}).value;return {type:'exit',key:'again',reason:'visit',...(${omitSecond}&&calls===2?{}:{memory:{value:calls,seen}})};}\n`;
  const definition=await api.saveCustomModuleDefinition(draft);graph.customDefinitions=[definition];graph.modules=graph.modules.filter(m=>m.kind==='custom').map(m=>({...m,definitionId:definition.definitionId,revisionId:definition.revisionId}));
  graph.nodes=graph.nodes.filter(n=>n.id!=='deliver');graph.nodes[0].exits={again:'second'};graph.nodes[1].moduleId='custom-a';graph.nodes[1].exits={again:'hold'};
  const old={graphState:{g:{stateId:'g-state',enteredTick:0,lastTick:9,transitionTicks:{},values:{},customState:{'custom-a':{value:5}}}}};
  const {bundle}=await compile(graph);const result=execute(bundle,context([actor('g')],10,old));
  assert.deepEqual(result.memoryPatch.set.graphState.g.customState['custom-a'],{value:omitSecond?1:2,seen:5});
 }
});
test('disabled and role-filtered custom bindings never invoke their authored body',async()=>{
 const {graph,definition}=await example();const changed=await api.saveCustomModuleDefinition({...definition,source:"import type {Input,Result} from './types';\nexport function decide(input:Input):Result {throw new Error('must not run');}\n"});
 graph.customDefinitions=[changed];for(const module of graph.modules)if(module.kind==='custom')module.revisionId=changed.revisionId;
 graph.modules.find(m=>m.moduleId==='custom-a').enabled=false;graph.modules.find(m=>m.moduleId==='custom-b').roleFilter=['guard'];
 const {bundle}=await compile(graph);const result=execute(bundle,context([actor('g'),actor('s','scout')]));
 assert.equal(visits(result,'g')[0].reasonCode,'disabled');assert.equal(visits(result,'s')[0].reasonCode,'role-filtered');assert.deepEqual(result.intents,[]);
});
test('cross-graph fragments carry only locked definitions and rebind typed values without changing source',async()=>{
 const {graph,definition}=await example();const fragment=api.exportGraphFragment(graph,'first');assert.deepEqual(fragment.customDefinitions,[definition]);
 const target=api.createLogisticsGraph();const imported=api.importGraphFragment(target,fragment,{rooms:{'room-1':'room-3'},ownRoles:{}});const next=api.applyGraphPatch(target,imported.patch);
 assert.equal(next.customDefinitions.length,1);assert.equal(next.modules.find(m=>m.moduleId===imported.idMap['custom-a']).config.resourceRoom.roomId,'room-3');assert.equal(next.customDefinitions[0].source,definition.source);
 const repeat=api.applyGraphPatch(next,api.importGraphFragment(next,fragment,{rooms:{'room-1':'room-2'},ownRoles:{}}).patch);assert.equal(repeat.customDefinitions.length,1);
 const renamed=api.applyGraphPatch(graph,api.renameGraphObject(graph,'deliver','return-home'));assert.equal(renamed.nodes[0].exits.bagFull,'return-home');
});
test('explicit version upgrade changes one instance; archived body source stays readable while edit recovery stays strict',async()=>{
 const {graph,definition}=await example();const before=(await compile(graph)).project;
 const next=await api.saveCustomModuleDefinition({...definition,source:definition.source.replace('cargo >=','cargo >')});
 const upgraded=api.applyGraphPatch(graph,api.upgradeCustomModule(graph,'custom-a',next));assert.equal(upgraded.modules.find(m=>m.moduleId==='custom-b').revisionId,definition.revisionId);
 const {project,bundle}=await compile(upgraded);const result=execute(bundle,context([actor('g','gatherer',4)]));assert.equal(result.intents[0].type,'gather');
 assert.equal(api.getCustomModuleSourceRef(before,'custom-a').file,`custom/${definition.revisionId}/body.ts`);assert.equal(api.getCustomModuleSourceRef(project,'custom-a').file,`custom/${next.revisionId}/body.ts`);
 const archive=structuredClone(before);archive.files['graph-runtime.ts']+='// archived runtime drift\n';assert.equal(api.recoverRuleGraph(archive),null);assert.ok(api.getCustomModuleSourceRef(archive,'custom-a'));
 archive.files[`custom/${definition.revisionId}/body.ts`]+='// manual body\n';assert.equal(api.getCustomModuleSourceRef(archive,'custom-a'),null);
 const reduced=await api.saveCustomModuleDefinition({...definition,fields:definition.fields.slice(1),exits:[],source:"import type {Input,Result} from './types';\nexport function decide(input:Input):Result{return {type:'hold',reason:'new'};}\n"});
 assert.deepEqual(api.previewCustomModuleUpgrade(graph,'custom-a',reduced),{removedFields:['limit'],removedExits:['bagFull'],affectedNodeIds:['first']});
 const changed=api.applyGraphPatch(graph,api.upgradeCustomModule(graph,'custom-a',reduced));assert.deepEqual(changed.nodes[0].exits,{});assert.equal(changed.nodes[0].fallback,'hold');
});
test('author TypeScript failures retain the actual body filename and line',async()=>{
 const draft=api.createCustomModuleDraft('error-kind');draft.source="import type {Input,Result} from './types';\nexport function decide(input:Input):Result {\n return {type:'action',intent:{type:'teleport'},reason:'bad'};\n}\n";
 const editor=api.customModuleEditorProject(draft);const result=await compileRule(editor.project);assert.ok(result.diagnostics.some(d=>d.file===editor.activeFile&&d.line===3));
});
test('v040/v050/v060 generated files remain byte-for-byte unchanged without custom modules',()=>{
 for(const [name,create] of [['v040-logistics',api.createLogisticsGraph],['v050-shortcut',api.createShortcutSupportGraph],['v060-composition',api.createCompositionGraph]]){
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/'+name+'-project.json',import.meta.url)));assert.deepEqual(api.toGraphSourceProject(create()),fixture);assert.deepEqual(api.recoverRuleGraph(fixture),create());
 }
});
test('custom bodies execute in the independent production V8 runner',{skip:!process.env.ARENA_SCRIPT_RUNNER},async()=>{
 const {graph}=await example();const {bundle}=await compile(graph);assert.equal(execute(bundle,context([actor('g','gatherer',1)])).intents[0].type,'gather');
});
