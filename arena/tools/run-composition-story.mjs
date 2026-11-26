// One visible-MCP acceptance story. Importing this driver executes it: run only in the assigned slot.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const out=process.env.ARENA_EVIDENCE_DIR;
if(!out||!process.env.ARENA_UI_URL||!process.env.ARENA_BASE_URL)throw Error('Set fresh ARENA_EVIDENCE_DIR, ARENA_UI_URL and ARENA_BASE_URL');
await fs.mkdir(out,{recursive:false});
const server=process.env.ARENA_TOOLS_SERVER??fileURLToPath(new URL('./server.mjs',import.meta.url));
const report={sourceCommit:process.env.ARENA_SOURCE_COMMIT,toolsServer:server,ui:process.env.ARENA_UI_URL,base:process.env.ARENA_BASE_URL,method:'visible stdio UI only; normal clock; recorded query; empty-state same-operation comparison',calls:[],milestones:[]};
const client=new Client({name:'v060-visible-composition-story',version:'1'});
const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});report.calls.push({name,args,isError:!!r.isError});assert(!r.isError,r.content[0]?.text);return JSON.parse(r.content[0].text);};
const action=action=>call('Input.action',{action}),state=()=>call('Page.getState');
const wait=async(predicate,label,ms=120000)=>{const until=Date.now()+ms;while(Date.now()<until){const s=await state();if(predicate(s))return s;await new Promise(resolve=>setTimeout(resolve,200));}throw Error('Timed out: '+label);};
const authority=s=>s.mobilityAuthority.find(Boolean),field=(label,value,scope)=>action({type:'setRuleGraphField',label,value,...(scope?{scope}:{})});
const checkpoint=async(name,value)=>{report.milestones.push({name,value});await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));};
const screenshot=async name=>{const r=await client.callTool({name:'Page.captureScreenshot',arguments:{}});assert(!r.isError);await fs.writeFile(out+'/'+name+'.png',Buffer.from(r.content[0].data,'base64'));};
try{
 await client.connect(new StdioClientTransport({command:process.execPath,args:[server],env:process.env,stderr:'pipe'}));await call('Page.open');await action({type:'startTraining'});
 const initial=await wait(s=>authority(s)?.actors.some(a=>a.role==='guard'),'initial own squad');
 const guard=authority(initial).actors.find(a=>a.role==='guard'),owner=guard.owner,gatherer=authority(initial).actors.find(a=>a.role==='gatherer'&&a.owner===owner);assert(gatherer);
 await action({type:'openBehavior'});
 for(const moduleId of ['retreat','haul','build','defend'])await action({type:'setBehaviorModule',moduleId,enabled:false});
 await action({type:'setBehaviorModule',moduleId:'gather',enabled:true,roles:['gatherer'],config:{targetRoomId:'room-1'}});
 await action({type:'openRuleGraph'});await action({type:'convertBehaviorToRuleGraph'});
 let graph=(await state()).graph.graph;const guardState=graph.roles.find(r=>r.role==='guard').initialStateId;
 const guardOnly=async()=>{const fields=(await state()).composition.preview.fields;for(const f of fields.filter(f=>f.type==='checkbox')){const role=['scout','gatherer','guard'].find(role=>f.label?.endsWith(' · '+role));if(role)await field(f.label,role==='guard','modulePreview');}};
 await action({type:'previewRuleModule',kind:'patrol'});await guardOnly();
 while((await state()).composition.preview.fields.filter(f=>f.label?.startsWith('巡逻站点 ')).length>1){const count=(await state()).composition.preview.fields.filter(f=>f.label?.startsWith('巡逻站点 ')).length;await action({type:'removeRulePatrolStop',index:count-1});}
 await field('巡逻站点 1','room-0','modulePreview');await field('驻留拍数',2,'modulePreview');await action({type:'setRuleModuleTarget',stateId:guardState});await action({type:'confirmRuleModule'});
 const beforeEscort=(await state()).graph.graph;
 await action({type:'previewRuleModule',kind:'escort'});await guardOnly();await field('受护岗位','guard','modulePreview');await field('最低货量',4,'modulePreview');await action({type:'setRuleModuleTarget',stateId:guardState});await action({type:'confirmRuleModule'});
 graph=(await state()).graph.graph;const escort=graph.modules.find(m=>!beforeEscort.modules.some(old=>old.moduleId===m.moduleId));assert.equal(escort.kind,'escort');
 const escortLeaf=graph.nodes.find(n=>n.id===graph.states.find(s=>s.id===guardState).treeId),patrolLeaf=graph.nodes.find(n=>n.id===escortLeaf.fallback);assert.equal(graph.modules.find(m=>m.moduleId===patrolLeaf.moduleId).kind,'patrol');
 await checkpoint('wrong-target-graph',{graph,owner,guardId:guard.id,gathererId:gatherer.id});
 await action({type:'openScripts'});await action({type:'compileScript'});await action({type:'publishScript'});const published=await wait(s=>authority(s).players.find(p=>p.id===owner)?.script?.sourceHash,'published A hash');const hashA=authority(published).players.find(p=>p.id===owner).script.sourceHash;
 await action({type:'closeRuleEditor'});await action({type:'startExpedition'});const firstCargo=await wait(s=>authority(s).actors.find(a=>a.id===gatherer.id)?.cargo>=4,'same real gatherer earns cargo four');await checkpoint('first-real-cargo',authority(firstCargo));await wait(s=>authority(s).tick>authority(firstCargo).tick&&authority(s).actors.find(a=>a.id===gatherer.id)?.cargo>=4,'one real decision tick with sufficient cargo');await action({type:'pauseExpedition'});const cargo=await state();assert(authority(cargo).paused);await checkpoint('real-cargo-before-fix',authority(cargo));
 await action({type:'openRuleGraph'});await action({type:'refreshRecording'});await wait(s=>s.recording.fields.some(f=>f.label==='录制源版本'&&f.options?.some(o=>o.value===hashA)),'recorded A version');
 await action({type:'selectRecordingVersion',sourceHash:hashA});await wait(s=>s.recording.fields.some(f=>f.label==='录制对象'&&f.options?.some(o=>o.value===escort.moduleId))||s.recording.sourceHash===hashA,'archive source loaded');
 await action({type:'selectRecordingObjectType',target:'module'});await wait(s=>s.recording.fields.some(f=>f.label==='录制对象'&&f.options?.some(o=>o.value===escort.moduleId)),'archived escort object');await action({type:'selectRecordingActor',actorId:guard.id});await action({type:'selectRecordingObject',objectId:escort.moduleId});await action({type:'setRecordingHitKind',kind:'fallback'});
 const loaded=await state(),last=Number(loaded.recording.fields.find(f=>f.label==='录制区间终点').max);await action({type:'saveRecordingRange',name:'有货但目标岗位误绑',fromOperation:0,toOperation:last});
 await action({type:'setRecordingCursor',operationIndex:-1});await action({type:'previousRecording'});let found=await wait(s=>s.recording.fact?.includes('escort-target-missing')&&s.recording.cursorOperation>=0,'recorded missing-target evidence');const operation=found.recording.cursorOperation;await wait(s=>s.replay?.status.some(text=>text.includes('已定位录制操作 '+operation+' ·')),'original replay located');await action({type:'closeReplay'});await checkpoint('original-fallback',(await state()).recording);
 // Query the same last recorded miss with the forward next-hit control as well.
 await action({type:'setRecordingCursor',operationIndex:operation-1});await action({type:'nextRecording'});found=await wait(s=>s.recording.cursorOperation===operation&&s.recording.fact?.includes('escort-target-missing'),'next fallback at exact original operation');await wait(s=>s.replay?.status.some(text=>text.includes('已定位录制操作 '+operation+' ·')),'next-hit replay located');await action({type:'closeReplay'});await action({type:'openRecordedSource'});await wait(s=>s.recording.source?.selectedLine?.length>0,'archived source line');await screenshot('recorded-target-missing');
 await action({type:'selectRuleGraphObject',kind:'modules',id:escort.moduleId});await field('受护岗位','gatherer');await action({type:'refreshRuleComparison'});await action({type:'setRuleComparisonBaseline',sourceHash:hashA});await action({type:'setRuleComparisonOperation',operationIndex:operation});await action({type:'compareRuleOperation'});
 const compared=await wait(s=>s.comparison.candidates.length===2&&s.comparison.status.length>0,'same-operation A/B');assert.equal(compared.comparison.alerts.length,0);const intents=side=>compared.comparison.candidates.find(c=>c.side===side).pre.flatMap(text=>{try{const value=JSON.parse(text);return Array.isArray(value)?value:[];}catch{return[];}});
 assert(!intents('A').some(i=>i.actorId===guard.id&&i.type==='move'&&i.roomId==='room-1'));assert(intents('B').some(i=>i.actorId===guard.id&&i.type==='move'&&i.roomId==='room-1'));await checkpoint('same-operation-empty-memory-AB',{operation,comparison:compared.comparison});await screenshot('same-operation-AB');
 await action({type:'openScripts'});await action({type:'compileScript'});await action({type:'publishScript'});const fixed=await state();assert.notEqual(authority(fixed).players.find(p=>p.id===owner).script.sourceHash,hashA);const start=authority(fixed).actors.find(a=>a.id===guard.id).worldPosition;await action({type:'closeRuleEditor'});await action({type:'startExpedition'});
 const moving=await wait(s=>{const a=authority(s).actors.find(a=>a.id===guard.id);return a.travel?.targetRoomId==='room-1'&&JSON.stringify(a.worldPosition)!==JSON.stringify(start);},'published guard actually moves toward resource room');await checkpoint('published-guard-real-travel',authority(moving));await action({type:'pauseExpedition'});const postPause=await state();await checkpoint('published-guard-post-pause',authority(postPause));await screenshot('guard-real-travel');
 assert(!report.calls.some(c=>c.args?.action?.type==='stepTraining'));report.completed=true;
}catch(e){report.failure=String(e.stack??e);throw e;}finally{await client.callTool({name:'Page.close',arguments:{}}).catch(()=>{});await client.close().catch(()=>{});await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}
