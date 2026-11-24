export const graphRuntimeSource = `import type {RuleContext,RuleDecisionResult,ActionIntentDraft,ActorScriptView,TaskPatchDraft,RuleMemory} from '@skyscraper/arena-script-sdk';
import {graph,modulePlan} from './graph-plan';
import type {GraphCondition,GraphEffect,GraphActorTrace,RuleNode} from './graph-plan';
import {decide as decideModule} from './module-runtime';
type ActorMemory={stateId:string;enteredTick:number;lastTick:number;transitionTicks:Record<string,number>;values:Record<string,string|number|boolean|null>};
type Outcome={intent?:ActionIntentDraft;selected:boolean;nodeId:string|null;moduleId:string|null;reason:string;logs:string[]};
export function decide(ctx:RuleContext):RuleDecisionResult {
 const previous=(ctx.memory.graphState??{}) as unknown as Record<string,ActorMemory>;
 const stateMemory:Record<string,ActorMemory>={};
 const traces:GraphActorTrace[]=[];const intents:ActionIntentDraft[]=[];const taskPatches:TaskPatchDraft[]=[];
 for(const actor of ctx.squad.actors){
  const role=graph.roles.find(r=>r.role===actor.role);
  const trace:GraphActorTrace={actorId:actor.id,startStateId:'',endStateId:'',transitionId:null,visited:[],selectedNodeId:null,moduleId:null,reason:'role has no graph entry'};
  traces.push(trace);if(!role)continue;
  const old=previous[actor.id];
  const valid=old && graph.states.some(s=>s.id===old.stateId);
  const memory:ActorMemory=valid?{...old,transitionTicks:{...old.transitionTicks},values:{...old.values}}:{stateId:old?role.fallbackStateId:role.initialStateId,enteredTick:ctx.tick,lastTick:-1,transitionTicks:{},values:{}};
  stateMemory[actor.id]=memory;trace.startStateId=memory.stateId;trace.endStateId=memory.stateId;
  if(actor.hp<=0){trace.reason='actor downed';continue;}
  const effectReasons:string[]=[];
  const effects=(items:GraphEffect[])=>{for(const effect of items){if(effect.type==='remember')memory.values[effect.key]=effect.value;
   else if(effect.type==='reason')effectReasons.push(effect.reason);
   else taskPatches.push({type:'upsert',task:{id:effect.taskId+'-'+actor.id,actorId:actor.id,roomId:effect.roomId,kind:effect.kind,priority:effect.priority,status:'queued',blockedReason:null}});
  }};
  const test=(condition:GraphCondition):boolean=>{
   if(condition.type==='all')return condition.conditions.every(test);
   if(condition.type==='any')return condition.conditions.some(test);
   if(condition.type==='not')return !test(condition.condition);
   if(condition.type==='atRoom')return actor.roomId===undefined?condition.missing:actor.roomId===condition.roomId;
   let value:number|undefined;
   switch(condition.field){case 'hp':value=actor.hp;break;case 'cargo':value=actor.cargo;break;case 'cargoCapacity':value=actor.cargoCapacity;break;case 'materials':value=ctx.player.materials;break;
    case 'tickInState':value=ctx.tick-memory.enteredTick;break;
    case 'roomEnemyHp':value=ctx.world.rooms.find(r=>r.id===actor.roomId)?.enemyHp;break;
    case 'targetEnemyHp':value=ctx.world.rooms.find(r=>r.id===condition.roomId)?.enemyHp;break;
   }
   if(value===undefined)return condition.missing;
   switch(condition.op){case 'lt':return value<condition.value;case 'lte':return value<=condition.value;case 'eq':return value===condition.value;case 'gte':return value>=condition.value;case 'gt':return value>condition.value;}
  };
  let state=graph.states.find(s=>s.id===memory.stateId)??graph.states.find(s=>s.id===role.fallbackStateId)!;
  if(!valid)effects(state.entry);
  if(memory.lastTick!==ctx.tick){
   const transitions=graph.transitions.map((t,index)=>({t,index})).filter(({t})=>t.from===state.id).sort((a,b)=>b.t.priority-a.t.priority||a.index-b.index);
   for(const {t} of transitions){
    if(ctx.tick-memory.enteredTick<t.minStateTicks||ctx.tick-(memory.transitionTicks[t.id]??-Infinity)<t.cooldownTicks)continue;
    const result=test(t.condition);trace.visited.push({nodeId:t.id,value:result});if(!result)continue;
    effects(state.exit);memory.stateId=t.to;memory.enteredTick=ctx.tick;memory.transitionTicks[t.id]=ctx.tick;trace.transitionId=t.id;
    state=graph.states.find(s=>s.id===t.to)!;effects(state.entry);break;
   }
  }
  memory.lastTick=ctx.tick;trace.endStateId=state.id;
  const empty=(reason:string):Outcome=>({selected:false,nodeId:null,moduleId:null,reason,logs:[]});
  const evaluate=(id:string):Outcome=>{
   const node=graph.nodes.find(n=>n.id===id)!;trace.visited.push({nodeId:id});
   switch(node.type){
    case 'check':{const value=test(node.condition);trace.visited[trace.visited.length-1].value=value;return {selected:value,nodeId:id,moduleId:null,reason:value?'check passed':'check failed',logs:[]};}
    case 'hold':return {selected:true,nodeId:id,moduleId:null,reason:node.reason,logs:[]};
    case 'condition':{const value=test(node.condition);trace.visited[trace.visited.length-1].value=value;return evaluate(value?node.yes:node.no);}
    case 'log':{const result=evaluate(node.next);return {...result,logs:[node.reason,...result.logs]};}
    case 'module':{
     const module=graph.modules.find(m=>m.moduleId===node.moduleId)!;
     modulePlan.modules=[module];
     const result=decideModule({...ctx,squad:{actors:[actor]},limits:{...ctx.limits,maxIntents:1}});
     const item=(result.memoryPatch?.set?.aiTrace as unknown as {actors:{moduleId:string;reason:string}[]})?.actors[0];
     if(item && item.moduleId===module.moduleId)return {selected:true,nodeId:id,moduleId:module.moduleId,intent:result.intents[0],reason:item.reason,logs:[]};
     const fallback=evaluate(node.fallback);return !fallback.intent && item?.reason==='travel in progress'?{...fallback,reason:item.reason}:fallback;
    }
    case 'priority':{for(const child of node.children){const result=evaluate(child);if(result.selected)return result;}return evaluate(node.fallback);}
    case 'sequence':{
     let chosen=empty('sequence has no result');const logs:string[]=[];
     for(const child of node.children){const result=evaluate(child);if(!result.selected)return evaluate(node.fallback);logs.push(...result.logs);if(result.intent){if(chosen.intent)return evaluate(node.fallback);chosen=result;}else if(!chosen.intent)chosen=result;}
     return chosen.selected?{...chosen,logs}:evaluate(node.fallback);
    }
    case 'score':{
     const candidates=node.candidates.map((candidate,index)=>({candidate,index})).filter(({candidate})=>{if(!candidate.when)return true;const value=test(candidate.when);trace.visited.push({nodeId:candidate.id,value});return value;}).sort((a,b)=>b.candidate.weight-a.candidate.weight||a.index-b.index);
     for(const {candidate} of candidates){trace.visited.push({nodeId:candidate.id,value:candidate.weight});const result=evaluate(candidate.nodeId);if(result.selected)return result;}return evaluate(node.fallback);
    }
   }
  };
  const result=evaluate(state.treeId);trace.selectedNodeId=result.nodeId;trace.moduleId=result.moduleId;trace.reason=[...effectReasons,...result.logs,result.reason].join('; ');
  if(result.intent){if(intents.length>=ctx.limits.maxIntents)throw new Error('Graph intent limit exceeded');intents.push(result.intent);}
 }
 if(taskPatches.length>ctx.limits.maxTaskPatches)throw new Error('Graph task patch limit exceeded');
 const patch={graphState:stateMemory,aiTrace:{v:2,tick:ctx.tick,graphId:graph.graphId,actors:traces}};
 const bytes=Array.from(JSON.stringify(patch)).reduce((total,c)=>{const code=c.codePointAt(0)!;return total+(code<128?1:code<2048?2:code<65536?3:4);},0);
 if(bytes>ctx.limits.maxMemoryBytes)throw new Error('Graph memory trace limit exceeded');
 return {intents,taskPatches,memoryPatch:{set:patch as unknown as RuleMemory}};
}
`;
