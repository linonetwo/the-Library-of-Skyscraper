import type {Snapshot} from './types';
/** Ownership and recorded progress only; this does not predict scoring or victory. */
export function tacticalObjective(snapshot:Snapshot,owner?:string){
 if(snapshot.scenarioId!=='seal-contest')return undefined;
 const point=snapshot.tactics?.controlPoints[0];
 const roomId=point?.roomId??snapshot.scenarioConfig?.controlPoints?.[0]?.roomId;
 const room=snapshot.rooms.find(r=>r.id===roomId);
 const label=snapshot.phase==='settled'?'演练结束':room?.owner&&room.owner===owner?'守住':'争夺';
 const progress=point?`占领 ${point.progressTicks}/${point.requiredTicks}${point.contested?' · 正在争夺':''}`:'等待控制点状态';
 return {title:room?`${label} · ${room.name}`:label,roomId,
  detail:`${room?.name??'控制点'} · ${progress} · ${snapshot.players.map(p=>`${p.name} ${p.score}分`).join(' / ')}${snapshot.result?' · 已结算':''}`};
}
