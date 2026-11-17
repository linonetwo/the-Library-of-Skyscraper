import { useArena, stateName } from "./ArenaWorkspace";
import { roleNames } from "./types";
export default function SelectedActorHUD() {
 const {actor,ready,isOwner,command,setInspecting}=useArena();
 if(!actor) return null;
 return <section className="selected-actor-hud" aria-label="选中角色操作">
  <div><strong>{roleNames[actor.role]}</strong><small>{actor.hp}/{actor.maxHp} · {stateName(actor.state)}</small></div>
  <button onClick={()=>setInspecting(true)}>详情 / 换装</button>
  {(['gather','deliver','attack','capture'] as const).map((type,i)=><button key={type}
   disabled={!ready||!isOwner||(type==='deliver'&&(actor.roomId!=='room-0'||actor.cargo===0))}
   onClick={()=>void command({type,actorId:actor.id})}>{['采集','卸货入库','攻击','编目'][i]}</button>)}
 </section>;
}
