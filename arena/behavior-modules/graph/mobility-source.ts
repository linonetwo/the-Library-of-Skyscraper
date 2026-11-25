/** Added only to projects that contain a mobility leaf; legacy project bytes stay fixed. */
export const mobilityContractSource = `export type MobilityAction =
 | {type:'run';viaRoomId:string;roomId:string}
 | {type:'jump'|'climb';edgeId:string};
`;
export const mobilityNodeSource = "  | {id:string;type:'mobility';action:MobilityAction;priority:number;fallback:string}\n";
export const mobilityRuntimeSource = `import type {RuleContext,ActorScriptView,ActionIntentDraft} from '@skyscraper/arena-script-sdk';
import type {MobilityAction} from './graph-plan';
type Selection={selected:boolean;intent?:ActionIntentDraft;reason:string};
/** Applicability only; the authority Command resolver owns route validation and motion. */
export function selectMobility(ctx:RuleContext,actor:ActorScriptView,action:MobilityAction,priority:number):Selection {
 if(actor.travel)return {selected:true,reason:'mobility travel in progress: '+actor.travel.targetRoomId+(actor.locomotion?' / '+actor.locomotion.phase:'')};
 const map=ctx.world.worldMap;
 if(!map?.mobilityEdges)return {selected:false,reason:'mobility unavailable in this recorded map'};
 if(action.type==='run'){
  const {viaRoomId,roomId}=action;
  const linked=(a:string,b:string)=>map.links.some(link=>(link.from===a&&link.to===b)||(link.from===b&&link.to===a));
  if(actor.roomId===roomId||actor.roomId===viaRoomId||!linked(actor.roomId,viaRoomId)||!linked(viaRoomId,roomId)||linked(actor.roomId,roomId))return {selected:false,reason:'run via/target not applicable at current room'};
  return {selected:true,intent:{type:'run',actorId:actor.id,viaRoomId,roomId,priority},reason:'run via '+viaRoomId+' to '+roomId};
 }
 const edge=map.mobilityEdges.find(edge=>edge.edgeId===action.edgeId&&edge.kind===action.type);
 if(!edge||(actor.roomId!==edge.fromRoomId&&actor.roomId!==edge.toRoomId))return {selected:false,reason:action.type+' edge not applicable at current room: '+action.edgeId};
 const target=actor.roomId===edge.fromRoomId?edge.toRoomId:edge.fromRoomId;
 return {selected:true,intent:{type:action.type,actorId:actor.id,edgeId:edge.edgeId,priority},reason:action.type+' '+edge.edgeId+' to '+target};
}
`;
export function addMobilityRuntime(source:string):string {
 return "import {selectMobility} from './mobility-runtime';\n"+source.replace("    case 'module':{",`    case 'mobility':{
     const choice=selectMobility(ctx,actor,node.action,node.priority);
     if(choice.selected)return {selected:true,nodeId:id,moduleId:null,intent:choice.intent,reason:choice.reason,logs:[]};
     const fallback=evaluate(node.fallback);return {...fallback,reason:choice.reason+'; '+fallback.reason};
    }
    case 'module':{`);
}
