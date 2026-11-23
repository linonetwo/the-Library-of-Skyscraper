import type { ActorRole, BehaviorModule } from '../../behavior-modules';
export const moduleNames = {gather:'采集藏材', haul:'运输入库', build:'建造设施', defend:'据点防守', retreat:'低血撤退'};
const roles: ActorRole[] = ['gatherer','guard','scout'];
const roleNames = {gatherer:'采集者',guard:'守卫',scout:'侦察者'};
export function BehaviorModuleCard({module:m,onChange,onSource}: {module:BehaviorModule;onChange:(m:BehaviorModule)=>void;onSource:()=>void}) {
  const config = (patch: object) => onChange({...m,config:{...m.config,...patch}} as BehaviorModule);
  return <article className="behavior-card" data-enabled={m.enabled} id={`module-${m.moduleId}`}>
    <header><label><input type="checkbox" checked={m.enabled} onChange={e=>onChange({...m,enabled:e.target.checked})}/><strong>{moduleNames[m.kind]}</strong></label><button onClick={onSource}>查看源码 ↗</button></header>
    <label>优先级 <input aria-label={`${moduleNames[m.kind]}优先级`} type="number" value={m.priority} onChange={e=>onChange({...m,priority:Number(e.target.value)})}/></label>
    <fieldset><legend>适用岗位 · 不勾选即全部</legend>{roles.map(role=><label key={role}><input type="checkbox" checked={m.roleFilter?.includes(role) ?? false} onChange={e=>onChange({...m,roleFilter:e.target.checked?[...(m.roleFilter??[]),role]:(m.roleFilter??[]).filter(r=>r!==role)})}/>{roleNames[role]}</label>)}</fieldset>
    {m.kind==='gather' && <label>目标房间 · 留空自动选择<input value={m.config.targetRoomId??''} onChange={e=>config({targetRoomId:e.target.value||undefined})}/></label>}
    {m.kind==='defend' && <label>防守房间 · 留空自动选择<input value={m.config.roomId??''} onChange={e=>config({roomId:e.target.value||undefined})}/></label>}
    {m.kind==='haul' && <label>最低携带藏材<input type="number" min="0" value={m.config.minCargo} onChange={e=>config({minCargo:Number(e.target.value)})}/></label>}
    {m.kind==='retreat' && <label>生命值阈值 %<input type="number" min="0" max="100" value={m.config.hpThreshold} onChange={e=>config({hpThreshold:Number(e.target.value)})}/></label>}
    {m.kind==='build' && <><label>建造房间<input value={m.config.roomId} onChange={e=>config({roomId:e.target.value})}/></label><label>设施<select value={m.config.buildingKind} onChange={e=>config({buildingKind:e.target.value})}><option value="catalog">目录馆</option><option value="tower">塔楼</option></select></label><label>最低建材<input type="number" min="0" value={m.config.minMaterials} onChange={e=>config({minMaterials:Number(e.target.value)})}/></label></>}
  </article>;
}
