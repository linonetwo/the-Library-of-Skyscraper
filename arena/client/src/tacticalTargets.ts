import type {Snapshot} from './types';
import type {TacticalCommand} from '../../shared/tactical';
export type TacticalActionKind='attack'|'repair'|'claim'|'cast';
export const tacticalLabels={attack:'集火',repair:'修复',claim:'占领',cast:'定向墨印'};
export function tacticalTargets(snapshot:Snapshot,owner:string,action:TacticalActionKind){
 const room=(id:string)=>snapshot.rooms.find(r=>r.id===id)?.name??'书库';
 if(action==='attack'||action==='cast')return [...(snapshot.enemies??[])].filter(e=>e.hp>0).sort((a,b)=>a.id.localeCompare(b.id)).map((e,i)=>({id:e.id,roomId:e.roomId,title:`书库守卫 ${i+1}`,detail:`${room(e.roomId)} · 生命 ${e.hp}/${e.maxHp}`}));
 if(action==='repair')return snapshot.buildings.filter(b=>b.owner===owner&&(b.hp??0)>0&&b.maxHp!==undefined&&(b.hp??0)<b.maxHp&&(b.constructionTicks??0)>=(b.requiredTicks??0)).map(b=>({id:b.id,roomId:b.roomId,title:({core:'据点',warehouse:'前线仓库',tower:'防御塔',catalog:'编目台'})[b.kind],detail:`${room(b.roomId)} · 耐久 ${b.hp}/${b.maxHp}`}));
 return (snapshot.scenarioConfig?.controlPoints??[]).flatMap(point=>{const r=snapshot.rooms.find(r=>r.id===point.roomId&&r.kind!=='base');return r?[{id:r.id,roomId:r.id,title:r.name,detail:r.owner===owner?'己方控制点':'控制点'}]:[];});
}
export function tacticalCommand(action:TacticalActionKind,actorId:string,targetId:string):TacticalCommand{
 if(action==='repair')return {type:action,actorId,buildingId:targetId};
 if(action==='claim')return {type:action,actorId,roomId:targetId};
 if(action==='cast')return {type:action,actorId,targetId,skillId:'ink-strike'};
 return {type:action,actorId,targetId};
}
