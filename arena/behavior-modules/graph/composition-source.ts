export const compositionContractSource = `export type RoomRef = { type: 'room'; roomId: string };
export type OwnRoleRef = { type: 'ownRole'; role: ActorRole };
export type ModuleRef = RoomRef | OwnRoleRef;
export type CompositionConfig = {
  scout: { target: RoomRef; maxEnemyHp: number; reportIntervalTicks: number };
  patrol: { rooms: RoomRef[]; dwellTicks: number };
  escort: { target: OwnRoleRef; minCargo: number };
};
export type CompositionModule = { [K in keyof CompositionConfig]: {
  moduleId: string; kind: K; enabled: boolean; priority: number;
  roleFilter?: ActorRole[]; config: CompositionConfig[K];
} }[keyof CompositionConfig];
export type GraphModule = BehaviorModule | CompositionModule;
export type ModuleReasonCode = 'official-selected' | 'official-unavailable' | 'disabled' | 'role-filtered' | 'room-missing' | 'risk-exceeded' | 'travel-active' | 'route-unavailable' | 'moving' | 'scout-reported' | 'scout-report-cooldown' | 'patrol-dwelling' | 'patrol-advanced' | 'escort-target-missing' | 'escort-safe' | 'escort-defending';
export interface ModuleVisit {
  nodeId: string; moduleId: string; outcome: 'selected' | 'fallback' | 'hold';
  reasonCode: ModuleReasonCode; ref?: ModuleRef; resolvedId?: string;
  observed?: { tick?: number; enemyHp?: number; threshold?: number; cargo?: number; cursor?: number; arrivedTick?: number };
  fallbackNodeId?: string;
}
`;
export const compositionRuntimeSource = `import type {RuleContext,ActorScriptView,ActionIntentDraft} from '@skyscraper/arena-script-sdk';
import type {CompositionModule,GraphModule,ModuleVisit,ModuleRef} from './graph-plan';
import {move,decide as decideModule} from './module-runtime';
import {modulePlan} from './graph-plan';
export type ModuleState={cursor?:number;arrivedTick?:number;reportedTick?:number};
export function isCompositionModule(module:GraphModule):module is CompositionModule{return module.kind==='scout'||module.kind==='patrol'||module.kind==='escort';}
export function selectComposition(ctx:RuleContext,actor:ActorScriptView,module:CompositionModule,state:ModuleState,nodeId:string,fallbackNodeId:string):{visit:ModuleVisit;intent?:ActionIntentDraft} {
 const visit:ModuleVisit={nodeId,moduleId:module.moduleId,outcome:'fallback',reasonCode:'disabled',fallbackNodeId};
 const selected=(reasonCode:ModuleVisit['reasonCode'],intent?:ActionIntentDraft)=>{visit.reasonCode=reasonCode;visit.outcome=intent?'selected':'hold';delete visit.fallbackNodeId;return {visit,intent};};
 const fallback=(reasonCode:ModuleVisit['reasonCode'])=>{visit.reasonCode=reasonCode;return {visit};};
 const travel=(ref:ModuleRef)=>{visit.ref=ref;return selected('travel-active');};
 const toward=(roomId:string)=>{const room=ctx.world.rooms.find(r=>r.id===roomId);if(!room)return fallback('room-missing');const intent=move(ctx,actor,room,module.priority);return intent?selected('moving',intent):fallback('route-unavailable');};
 if(!module.enabled)return fallback('disabled');
 if(module.roleFilter&&!module.roleFilter.includes(actor.role))return fallback('role-filtered');
 if(module.kind==='scout'){
  const ref=module.config.target;visit.ref=ref;visit.resolvedId=ref.roomId;
  const room=ctx.world.rooms.find(r=>r.id===ref.roomId);if(!room)return fallback('room-missing');
  visit.observed={enemyHp:room.enemyHp,threshold:module.config.maxEnemyHp};
  if(room.enemyHp>module.config.maxEnemyHp)return fallback('risk-exceeded');
  if(actor.travel)return travel(ref);
  if(actor.roomId!==room.id)return toward(room.id);
  if(state.reportedTick!==undefined&&ctx.tick-state.reportedTick<module.config.reportIntervalTicks)return selected('scout-report-cooldown');
  state.reportedTick=ctx.tick;visit.observed={tick:ctx.tick,enemyHp:room.enemyHp};return selected('scout-reported');
 }
 if(module.kind==='patrol'){
  const cursor=(state.cursor??0)%module.config.rooms.length;const ref=module.config.rooms[cursor];visit.ref=ref;visit.resolvedId=ref.roomId;visit.observed={cursor};
  if(!ctx.world.rooms.some(r=>r.id===ref.roomId))return fallback('room-missing');
  if(actor.travel){delete state.arrivedTick;return travel(ref);}
  if(actor.roomId!==ref.roomId){delete state.arrivedTick;return toward(ref.roomId);}
  if(state.arrivedTick===undefined)state.arrivedTick=ctx.tick;
  visit.observed={cursor,arrivedTick:state.arrivedTick};
  if(ctx.tick-state.arrivedTick<module.config.dwellTicks)return selected('patrol-dwelling');
  state.cursor=(cursor+1)%module.config.rooms.length;delete state.arrivedTick;
  return selected('patrol-advanced');
 }
 visit.ref=module.config.target;
 const target=ctx.squad.actors.filter(a=>a.id!==actor.id&&a.owner===actor.owner&&a.hp>0&&a.role===module.config.target.role&&a.cargo>=module.config.minCargo).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)[0];
 if(!target)return fallback('escort-target-missing');
 visit.resolvedId=target.id;visit.observed={cargo:target.cargo,threshold:module.config.minCargo};
 if(actor.travel)return selected('travel-active');
 const targetRoomId=target.travel?.targetRoomId??target.roomId;
 if(actor.roomId!==targetRoomId)return toward(targetRoomId);
 const room=ctx.world.rooms.find(r=>r.id===actor.roomId);if(!room)return fallback('room-missing');
 if(room.enemyHp<=0&&!ctx.world.enemies?.some(e=>e.roomId===room.id&&e.hp>0))return selected('escort-safe');
 modulePlan.modules=[{moduleId:module.moduleId,kind:'defend',enabled:true,priority:module.priority,config:{roomId:room.id}}];
 const decision=decideModule({...ctx,squad:{actors:[actor]},limits:{...ctx.limits,maxIntents:1}});
 return selected('escort-defending',decision.intents[0]);
}
`;
