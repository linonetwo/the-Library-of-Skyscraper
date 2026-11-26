import {useArena} from './ArenaWorkspace';
import {tacticalTargets,tacticalCommand,tacticalSelectionKey,type TacticalActionKind} from './tacticalTargets';
export function useTacticalActions(){
 const arena=useArena(),{snapshot,session,actor,command,busy,isOwner,ready}=arena;
 const {tacticalAction:action,setTacticalAction:setAction,tacticalSelection:selection}=arena;
 const targets=snapshot&&session?tacticalTargets(snapshot,session.playerId,action):[];
 const target=targets.find(t=>tacticalSelectionKey(snapshot!.sessionId,actor?.id??'',action,t.id)===selection);
 const state=snapshot?.tactics?.actorStates.find(s=>s.actorId===actor?.id);
 const point=snapshot?.tactics?.controlPoints.find(p=>p.roomId===target?.id);
 const result=snapshot?.events.filter(e=>e.tactical?.actorId===actor?.id).at(-1)?.tactical;
 const enabled=!!(ready&&isOwner&&actor&&actor.hp>0&&!busy&&!arena.player?.script&&target&&(action!=='cast'||(actor.appearance.weapon&&state?.weapon==='staff')));
 return {...arena,action,setAction,target,targets,state,point,result,enabled,
  choose:arena.chooseTacticalTarget,
  submit:()=>{if(enabled&&actor&&target)return command(tacticalCommand(action,actor.id,target.id));}};
}
