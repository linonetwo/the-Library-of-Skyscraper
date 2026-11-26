export const tacticalContractSource=`import type {EnemyRef,OwnBuildingRef,ControlPointRef} from '@skyscraper/arena-script-sdk';
export type TacticalConfig={attack:{target:EnemyRef};repair:{target:OwnBuildingRef};claim:{target:ControlPointRef};cast:{target:EnemyRef;skillId:'ink-strike'}};
export type TacticalModule={[K in keyof TacticalConfig]:{moduleId:string;kind:K;enabled:boolean;priority:number;roleFilter?:ActorRole[];config:TacticalConfig[K]}}[keyof TacticalConfig];
`;
export function addTacticalContract(source:string):string {
 return tacticalContractSource+source
 .replace('BehaviorModule | CompositionModule','BehaviorModule | CompositionModule | TacticalModule')
 .replace('export type ModuleRef = RoomRef | OwnRoleRef;','export type ModuleRef = RoomRef | OwnRoleRef | EnemyRef | OwnBuildingRef | ControlPointRef;')
 .replace('export type ModuleReasonCode = ',"export type ModuleReasonCode = 'tactics-unavailable' | 'target-missing' | 'cast-active' | 'recovery-active' | 'claim-active' | 'attack-requested' | 'repair-requested' | 'claim-requested' | 'cast-requested' | ")
 .replace('arrivedTick?: number }','arrivedTick?: number; hp?: number; maxHp?: number; materials?: number; energy?: number; readyTick?: number; progressTicks?: number }');
}
export function addTacticalRuntime(source:string):string {
 return "import {isTacticalModule,selectTactical} from './tactical-runtime';\n"+source.replace('     if(isCompositionModule(module)){',`     if(isTacticalModule(module)){
      const choice=selectTactical(ctx,actor,module,id,node.fallback);
      if(trace.moduleVisits!.length<8)trace.moduleVisits!.push(choice.visit);else trace.moduleVisitsTruncated=true;
      if(choice.visit.outcome==='fallback')return evaluate(node.fallback);
      return {selected:true,nodeId:id,moduleId:module.moduleId,intent:choice.intent,reason:choice.visit.reasonCode,logs:[]};
     }
     if(isCompositionModule(module)){`);
}
export const tacticalRuntimeSource=`import type {RuleContext,ActorScriptView,ActionIntentDraft} from '@skyscraper/arena-script-sdk';
import type {TacticalModule,GraphModule,ModuleVisit} from './graph-plan';
import {move} from './module-runtime';
export function isTacticalModule(module:GraphModule):module is TacticalModule{return module.kind==='attack'||module.kind==='repair'||module.kind==='claim'||module.kind==='cast';}
export function selectTactical(ctx:RuleContext,actor:ActorScriptView,module:TacticalModule,nodeId:string,fallbackNodeId:string):{visit:ModuleVisit;intent?:ActionIntentDraft} {
 const visit:ModuleVisit={nodeId,moduleId:module.moduleId,outcome:'fallback',reasonCode:'disabled',fallbackNodeId};
 const fallback=(reasonCode:ModuleVisit['reasonCode'])=>{visit.reasonCode=reasonCode;return {visit};};
 const selected=(reasonCode:ModuleVisit['reasonCode'],intent?:ActionIntentDraft)=>{visit.reasonCode=reasonCode;visit.outcome=intent?'selected':'hold';delete visit.fallbackNodeId;return {visit,intent};};
 if(!module.enabled)return fallback('disabled');
 if(module.roleFilter&&!module.roleFilter.includes(actor.role))return fallback('role-filtered');
 const tactics=ctx.world.tactics;if(!tactics)return fallback('tactics-unavailable');
 const self=tactics.actorStates.find(state=>state.actorId===actor.id);
 visit.ref=module.config.target;
 if(actor.travel)return selected('travel-active');
 if(self?.cast&&ctx.tick<self.cast.endsTick)return selected('cast-active');
 if(self?.recovery&&ctx.tick<self.recovery.endsTick)return selected('recovery-active');
 let roomId:string;
 if(module.kind==='claim'){
  const ref=module.config.target;
  const point=tactics.controlPoints.find(point=>point.roomId===ref.roomId);
  const room=ctx.world.rooms.find(room=>room.id===ref.roomId);
  if(!point||!room)return fallback('target-missing');
  visit.resolvedId=roomId=room.id;visit.observed={progressTicks:point.progressTicks};
 }else if(module.kind==='repair'){
  const ref=module.config.target;
  const target=ctx.world.buildings.filter(building=>building.owner===actor.owner&&(building.hp??0)>0&&(building.hp??0)<(building.maxHp??0)&&(building.constructionTicks??0)>=(building.requiredTicks??0)&&
   (ref.type==='ownBuilding'?building.id===ref.buildingId:building.roomId===ref.roomId))
   .sort((a,b)=>((b.maxHp!-b.hp!)-(a.maxHp!-a.hp!))||(a.id<b.id?-1:a.id>b.id?1:0))[0];
  if(!target)return fallback('target-missing');
  visit.resolvedId=target.id;roomId=target.roomId;visit.observed={hp:target.hp,maxHp:target.maxHp,materials:ctx.player.materials};
 }else{
  const ref=module.config.target;
  const target=ctx.world.enemies?.filter(enemy=>enemy.hp>0&&(ref.type==='enemy'?enemy.id===ref.enemyId:enemy.roomId===ref.roomId))
   .sort((a,b)=>(a.hp-b.hp)||(a.id<b.id?-1:a.id>b.id?1:0))[0];
  if(!target)return fallback('target-missing');
  visit.resolvedId=target.id;roomId=target.roomId;visit.observed={hp:target.hp,maxHp:target.maxHp,...(module.kind==='cast'&&self?{energy:self.energy,readyTick:self.castReadyTick}:{})};
 }
 if(actor.roomId!==roomId){
  const room=ctx.world.rooms.find(room=>room.id===roomId);if(!room)return fallback('room-missing');
  const intent=move(ctx,actor,room,module.priority);return intent?selected('moving',intent):fallback('route-unavailable');
 }
 const base={actorId:actor.id,priority:module.priority};
 switch(module.kind){
  case 'attack':return selected('attack-requested',{...base,type:'attack',targetId:visit.resolvedId!});
  case 'repair':return selected('repair-requested',{...base,type:'repair',buildingId:visit.resolvedId!});
  case 'claim':return actor.task?.kind==='claim'&&actor.task.target===roomId?selected('claim-active'):selected('claim-requested',{...base,type:'claim',roomId});
  case 'cast':return selected('cast-requested',{...base,type:'cast',skillId:module.config.skillId,targetId:visit.resolvedId!});
 }
}
`;
