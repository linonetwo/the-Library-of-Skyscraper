import { useState } from "react";
import { useArena,stateName } from "./ArenaWorkspace";
import { roleNames } from "./types";
import PaperDoll from "./PaperDoll";
import SimulationBar from "./SimulationBar";
export default function GameHUD(){
 const [menu,setMenu]=useState(false),[training,setTraining]=useState(false);
 const {actor,ownActors,selectActor,player,connection,setView,setLobby,setHelp,setInspecting,setSelectedRoom,command,ready,isOwner}=useArena();
 return <div className="game-hud"><header className="game-top"><span>藏材 {player?.materials??0} · 得分 {player?.score??0}</span><span title={connection}>●</span><button onClick={()=>{setMenu(!menu);setSelectedRoom(null);setInspecting(false);}}>菜单</button></header>
 {menu&&<nav className="game-menu" aria-label="游戏菜单">{(['rules','journal'] as const).map((view,i)=><button key={view} onClick={()=>{setView(view);setMenu(false);}}>{['行动规则','赛局日志'][i]}</button>)}<button onClick={()=>setLobby(true)}>联机大厅</button><a href="/animation-lab">纸娃娃工坊</a><button onClick={()=>setHelp(true)}>操作指南</button><button onClick={()=>setTraining(!training)}>训练控制</button><button onClick={()=>setMenu(false)}>关闭菜单</button></nav>}
 {training&&<div className="game-training"><button onClick={()=>setTraining(false)}>收起训练控制</button><SimulationBar/></div>}
 {actor&&<section className="game-dock" aria-label="选中角色操作"><div className="dock-squad">{ownActors.map(unit=><button key={unit.id} className={actor.id===unit.id?'selected':''} aria-label={`选择${roleNames[unit.role]}`} onClick={()=>selectActor(unit.id)}><PaperDoll small {...unit.appearance}/></button>)}</div><div className="dock-summary"><strong>{roleNames[actor.role]}</strong><small>{actor.hp}/{actor.maxHp} · {stateName(actor.state)}</small></div><div className="dock-actions">{(['gather','deliver'] as const).map((type,i)=><button key={type} disabled={!ready||!isOwner||(type==='deliver'&&(actor.roomId!=='room-0'||actor.cargo===0))} onClick={()=>void command({type,actorId:actor.id})}>{['采集','卸货入库'][i]}</button>)}<button onClick={()=>{setInspecting(true);setSelectedRoom(null);}}>详情 / 换装</button></div></section>}
 </div>;
}
