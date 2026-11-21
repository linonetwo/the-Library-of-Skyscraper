import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../tools/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const base = process.env.ARENA_BASE_URL ?? 'http://127.0.0.1:8787';
const enabled = process.env.ARENA_INTEGRATION === '1';
const hold = { files: { 'main.ts': 'export function decide() { return { intents: [] }; }' } };
async function http(path, body, token, status = 200) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
const route = (session, suffix, body, status) =>
  http(`/api/sessions/${session.sessionId}/${suffix}`, body, session.token, status);


const counter = { files: { 'main.ts': `import type { RuleContext } from '@skyscraper/arena-script-sdk';
export function decide(ctx: RuleContext) {
 return { intents: [], memoryPatch: {set:{ticks: Number(ctx.memory.ticks ?? 0)+1}},
 taskPatches: ctx.squad.actors.map(actor => ({type:'upsert' as const,task:{
 id:actor.id,actorId:actor.id,roomId:actor.roomId,kind:'gather' as const,
 priority:50,status:'running' as const,blockedReason:null}})) };
}` } };
test('real V8 HTTP memory persists, preview is pure, versions restore and reset clears', { skip: !enabled }, async () => {
 const session = await http('/api/sessions', {mode:'training'});
 await route(session,'commands',{type:'reset'});
 const published = await route(session,'scripts/publish',counter);
 await route(session,'commands',{type:'step',ticks:2});
 const state = await route(session,'scripts/state');
 assert.equal(state.sourceHash,published.compilation.bundle.sourceHash);
 assert.equal(state.memory.ticks,2);
 assert.equal(state.tasks.items.length,3);
 await route(session,'scripts/preview',counter);
 await route(session,'scripts/preview',counter);
 assert.deepEqual(await route(session,'scripts/state'),state);
 await route(session,'scripts/publish',hold);
 assert.deepEqual((await route(session,'scripts/state')).memory,{});
 assert.equal((await route(session,'scripts/state')).tasks.items.length,3);
 await route(session,'scripts/rollback',{sourceHash:state.sourceHash});
 assert.equal((await route(session,'scripts/state')).memory.ticks,2);
 await route(session,'commands',{type:'step',ticks:1});
 assert.equal((await route(session,'scripts/state')).memory.ticks,3);
 const replay = await route(session,'replay');
 assert(replay.finalRuleState);
 await route(session,'commands',{type:'reset'});
 assert.deepEqual((await route(session,'scripts/state')).memory,{});
 assert.deepEqual((await route(session,'scripts/state')).tasks.items,[]);
});
test('real MCP reads the same private runtime memory', { skip: !enabled }, async t => {
 const client = new Client({name:'state-test',version:'1'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../tools/server.mjs',import.meta.url))],env:{...process.env,ARENA_BASE_URL:base}}));
 t.after(()=>client.close());
 const call = async (name,args) => {const result=await client.callTool({name,arguments:args});assert.notEqual(result.isError,true,JSON.stringify(result));return JSON.parse(result.content[0].text);};
 const session=await call('Session.create',{mode:'training'});
 const args={handle:session.handle};
 await call('Simulation.reset',args);
 await call('Script.publish',{...args,...counter});
 await call('Simulation.step',{...args,ticks:2});
 const state=await call('Script.getState',args);
 assert.equal(state.memory.ticks,2);
 assert.equal(state.tasks.items.length,3);
});

test('online owners share source hash but keep memory, tasks and replay private', { skip: !enabled }, async () => {
 const one=await http('/api/sessions',{mode:'online'});
 const two=await http('/api/sessions/'+one.sessionId+'/join',{});
 const a=await route(one,'scripts/publish',counter);
 const b=await route(two,'scripts/publish',counter);
 assert.equal(a.compilation.bundle.sourceHash,b.compilation.bundle.sourceHash);
 let first,second;
 for(let attempt=0;attempt<30;attempt++){
   first=await route(one,'scripts/state');second=await route(two,'scripts/state');
   if(first.memory.ticks>=2 && second.memory.ticks>=2) break;
   await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert(first.memory.ticks>=2);assert(second.memory.ticks>=2);
 assert(first.tasks.items.every(task=>task.actorId.startsWith(one.playerId)));
 assert(second.tasks.items.every(task=>task.actorId.startsWith(two.playerId)));
 await route(one,'scripts/disable',{});
 const frozen=await route(one,'scripts/state');
 const before=await route(two,'state');
 const deadline=Date.now()+1100;
 let later=before;
 while(later.tick<=before.tick && Date.now()<deadline){
   await new Promise(resolve=>setTimeout(resolve,50));
   later=await route(two,'state');
 }
 assert(later.tick>before.tick,'online authority advances within the original observation window');
 assert.deepEqual((await route(one,'scripts/state')).memory,frozen.memory);
 assert((await route(two,'scripts/state')).memory.ticks>second.memory.ticks);
 const replay=await route(one,'replay');
 assert(replay.finalRuleState);
 assert.equal(replay.finalRuleState.playerId,one.playerId);
 for(const operation of replay.operations){
  for(const decision of operation.decisions ?? []){
   if(decision.playerId===two.playerId){assert.equal(decision.memoryPatch,undefined);assert.equal(decision.taskPatches,undefined);}
  }
 }
 const serialized=JSON.stringify(replay.finalRuleState);
 assert(!serialized.includes(two.playerId+'-gatherer'));
});
