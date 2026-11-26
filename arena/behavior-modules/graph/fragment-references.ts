import type { GraphFragment, RoomRef, OwnRoleRef, GraphModule } from './composition-types';
import type { GraphCondition, RuleNode } from './types';
/** One domain traversal drives both binding inventory and rewriting. */
export function mapFragmentRefs(fragment:GraphFragment,map:(ref:RoomRef|OwnRoleRef)=>RoomRef|OwnRoleRef):GraphFragment {
 const room=(roomId:string)=>(map({type:'room',roomId}) as RoomRef).roomId;
 const ownRole=(role:OwnRoleRef['role'])=>(map({type:'ownRole',role}) as OwnRoleRef).role;
 const condition=(c:GraphCondition):GraphCondition=>{
  switch(c.type){case 'all':case 'any':return {...c,conditions:c.conditions.map(condition)};case 'not':return {...c,condition:condition(c.condition)};
   case 'atRoom':return {...c,roomId:room(c.roomId)};case 'compare':return c.roomId===undefined?c:{...c,roomId:room(c.roomId)};}
 };
 const node=(n:RuleNode):RuleNode=>{
  switch(n.type){case 'condition':case 'check':return {...n,condition:condition(n.condition)};
   case 'score':return {...n,candidates:n.candidates.map(c=>c.when?{...c,when:condition(c.when)}:c)};
   case 'mobility':return n.action.type==='run'?{...n,action:{...n.action,viaRoomId:room(n.action.viaRoomId),roomId:room(n.action.roomId)}}:n;
   default:return n;}
 };
 const module=(m:GraphModule):GraphModule=>{
  const base=m.roleFilter?{...m,roleFilter:m.roleFilter.map(ownRole)}:m;
  switch(base.kind){case 'scout':return {...base,config:{...base.config,target:{type:'room',roomId:room(base.config.target.roomId)}}};
   case 'patrol':return {...base,config:{...base.config,rooms:base.config.rooms.map(ref=>({type:'room',roomId:room(ref.roomId)}))}};
   case 'escort':return {...base,config:{...base.config,target:{type:'ownRole',role:ownRole(base.config.target.role)}}};
   case 'gather':return base.config.targetRoomId===undefined?base:{...base,config:{...base.config,targetRoomId:room(base.config.targetRoomId)}};
   case 'defend':return base.config.roomId===undefined?base:{...base,config:{...base.config,roomId:room(base.config.roomId)}};
   case 'build':return {...base,config:{...base.config,roomId:room(base.config.roomId)}};
   default:return base;}
 };
 const copy=structuredClone(fragment);return {...copy,nodes:copy.nodes.map(node),modules:copy.modules.map(module)};
}
