import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

test('visible mobility controls preview then issue three authoritative routes', {
  skip: process.env.ARENA_MOBILITY_BROWSER !== '1', timeout: 90000,
}, async t => {
const {Client}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
const {StdioClientTransport}=await import('../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js');
const client=new Client({name:'mobility-visible-controls',version:'1'});
await client.connect(new StdioClientTransport({command:process.execPath,
  args:[fileURLToPath(new URL('../tools/server.mjs',import.meta.url))],env:process.env,stderr:'pipe'}));
t.after(async()=>{await client.callTool({name:'Page.close',arguments:{}}).catch(()=>{});await client.close();});
const observations=[];
const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});assert(!r.isError,r.content[0]?.text);return JSON.parse(r.content[0].text);};const action=a=>call('Input.action',{action:a});const state=()=>call('Page.getState');
const wait=async(predicate)=>{const deadline=Date.now()+10000;do{const s=await state();if(predicate(s))return s;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);throw Error('visible authority state did not reach expected sample');};
const actor=(s,role)=>s.mobilityAuthority?.find(Boolean)?.actors.find(a=>a.role===role);
await call('Page.open');await action({type:'startTraining'});await action({type:'resetTraining'});
for(const item of [{kind:'run',role:'guard',start:'room-1',target:'room-3'},{kind:'jump',role:'gatherer',start:'room-2',target:'room-1',edgeId:'jump-room-1-room-2'},{kind:'climb',role:'scout',start:'room-4',target:'room-3',edgeId:'climb-room-4-room-3'}]){
 if(item.kind!=='run')await action({type:'resetTraining'});
 await action({type:'selectActor',role:item.role});await action({type:'assignTask',kind:'guard',target:item.start});
 let s;for(let i=0;i<45;i++){await action({type:'stepTraining'});s=await wait(s=>!!actor(s,item.role));if(actor(s,item.role).roomId===item.start&&!actor(s,item.role).travel)break;}
 assert.equal(actor(s,item.role).roomId,item.start);assert(!actor(s,item.role).travel);
 await action({type:'chooseMobility',kind:item.kind});
 if(item.kind==='run')await action({type:'setRunRoute',viaRoomId:'room-0',roomId:item.target});else await action({type:'selectMobilityEdge',edgeId:item.edgeId});
 const preview=await state();const previewActor=actor(preview,item.role);assert(!previewActor.travel);assert.equal(previewActor.roomId,item.start);assert.equal(preview.mobility[0].confirmDisabled,false);
 await action({type:'confirmMobility'});s=await wait(s=>actor(s,item.role)?.travel?.targetRoomId===item.target);assert.equal(s.mobility[0].kind,null);const first=actor(s,item.role);await action({type:'stepTraining'});s=await wait(s=>actor(s,item.role)?.travel?.segmentElapsedMicros>0||actor(s,item.role)?.travel?.distanceMilli>0);const moved=actor(s,item.role);assert(moved.locomotion);assert.notDeepEqual(moved.worldPosition,first.worldPosition);observations.push({kind:item.kind,start:item.start,target:item.target,previewDidNotCommand:true,confirmedTravelId:first.travel.travelId,afterStep:{roomId:moved.roomId,worldPosition:moved.worldPosition,worldHeightMilli:moved.worldHeightMilli,locomotion:moved.locomotion,segment:moved.travel.segment},simVersion:s.mobilityAuthority[0].simulationVersion});
}
assert.deepEqual(observations.map(item=>item.kind),['run','jump','climb']);
});
