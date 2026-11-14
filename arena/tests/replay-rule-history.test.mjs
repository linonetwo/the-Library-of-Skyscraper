import test from 'node:test';
import assert from 'node:assert/strict';
const enabled = process.env.ARENA_INTEGRATION === '1';
const base = process.env.ARENA_BASE_URL ?? 'http://127.0.0.1:8787';
const source = `import type { RuleContext } from '@skyscraper/arena-script-sdk'; export function decide(ctx: RuleContext) { return {intents:[], memoryPatch:{set:{ticks:Number(ctx.memory.ticks??0)+1}}, taskPatches:ctx.squad.actors.map(actor=>({type:'upsert' as const,task:{id:actor.id,actorId:actor.id,roomId:actor.roomId,kind:'gather' as const,priority:50,status:'running' as const,blockedReason:null}}))}; }`;
export const counter = { files: {'main.ts': source} };
async function request(path, body, token) {
 const response = await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json(); assert.equal(response.status,200,JSON.stringify(value)); return value;
}
test('actual timeline route carries only each authenticated owner’s private deltas', {skip:!enabled}, async()=>{
 const one=await request('/api/sessions',{mode:'online'});
 const two=await request(`/api/sessions/${one.sessionId}/join`,{});
 const route=(session,suffix,body)=>request(`/api/sessions/${session.sessionId}/${suffix}`,body,session.token);
 for(const owner of [one,two]) await route(owner,'scripts/publish',counter);
 for(let attempt=0;attempt<30;attempt++){
  if((await route(two,'scripts/state')).memory.ticks>=2)break;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 for(const [owner,opponent] of [[one,two],[two,one]]){
  const timeline=await route(owner,'replay/timeline');
  assert.equal(timeline.ruleHistory.playerId,owner.playerId);
  assert(timeline.ruleHistory.changes.length>0);
  for(const change of timeline.ruleHistory.changes){
   assert(change.operationIndex>0);
   for(const patch of change.taskPatches??[])assert(patch.task.actorId.startsWith(owner.playerId));
  }
  assert(!JSON.stringify(timeline.ruleHistory).includes(opponent.playerId+'-'));
 }
});

