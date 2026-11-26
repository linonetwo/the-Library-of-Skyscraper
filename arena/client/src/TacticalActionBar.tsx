import {useTacticalActions} from './useTacticalActions';
import {tacticalLabels,type TacticalActionKind} from './tacticalTargets';
import './styles/tactical-actions.css';
const phases:Record<string,string>={applied:'已执行',rejected:'未执行',approaching:'正在接近',started:'已开始',progress:'进行中',contested:'争夺中',captured:'已占领',reset:'进度重置',released:'已释放',interrupted:'已中断',completed:'已完成',downed:'被击倒',rising:'正在起身',telegraph:'重击预警'};
const reasons:Record<string,string>={
 'target-gone':'请重新选择存活目标',
 'target-outside-room':'请先前往目标所在房间',
 'out-of-range':'请接近目标后再次行动',
 'attack-cooldown':'出手冷却后可再次攻击',
 'not-control-point':'请选择控制点房间',
 'point-outside-room':'请先前往控制点房间',
 'actor-downed':'角色恢复后可继续行动',
 'actor-travelling':'抵达后可继续行动',
 'actor-not-grounded':'落地后可继续行动',
 'actor-retreating':'撤退结束后可继续行动',
 'actor-recovering':'起身后可继续行动',
 'actor-casting':'等待本次咏唱结束',
 'actor-already-acted':'下一拍可继续行动',
 'point-defended':'清除控制点守卫后可占领',
 'point-contested':'控制点争夺中，请继续驻守',
 'no-claimant':'请派角色前往控制点占领',
 'building-gone':'请重新选择现有设施',
 'building-not-owned':'请选择己方设施',
 'building-destroyed':'请选择存活的己方设施',
 'building-incomplete':'设施建成后可维修',
 'building-full':'设施耐久已满，可选择其他受损设施',
 'building-outside-room':'请先前往设施所在房间',
 'insufficient-materials':'先采运建材入库',
 'repair-cooldown':'维修冷却后可再次维修',
 'staff-required':'装备法杖后可施放墨印',
 'cast-cooldown':'施法冷却结束后可再次施放',
 'insufficient-energy':'等待能量恢复后施放',
 'chant-context-mismatch':'请针对当前目标重新施放',
 'chant-mismatch':'请在墨印 TS 中按顺序观察、聚能、封印',
 'chant-error':'请修正墨印 TS 运行错误后重新发布',
 'heavy-hit':'咏唱被重击打断，恢复后可重新施放',
};
const reason=(code:string)=>reasons[code]??code;
export default function TacticalActionBar(){
 const t=useTacticalActions(),s=t.snapshot;
 if(!s||(s.simulationVersion??0)<8)return null;
 const config=s.scenarioConfig,range=t.action==='repair'?config?.repair?.rangeMilli:t.action==='cast'?config?.inkStrike?.rangeMilli:t.action==='claim'?config?.controlPoints?.find(p=>p.roomId===t.target?.id)?.radiusMilli:config?.attack?.rangeMilli;
 const cost=t.action==='repair'&&config?.repair?`每次 ${config.repair.materialCost} 建材 · 修复 ${config.repair.healHp} 耐久`:t.action==='cast'&&config?.inkStrike?`消耗 ${config.inkStrike.energyCost} 能量`:'无建材消耗';
 return <section className="tactical-bar" aria-label="战术行动">
  <strong>战术</strong><label>行动<select aria-label="战术行动" value={t.action} onChange={e=>t.setAction(e.target.value as TacticalActionKind)}>{Object.entries(tacticalLabels).map(([key,name])=><option key={key} value={key} disabled={key==='cast'&&!t.actor?.appearance.weapon}>{name}</option>)}</select></label>
  <label className="tactical-target">目标<select aria-label="战术目标" value={t.target?.id??''} onChange={e=>t.choose(e.target.value)}><option value="">选择真实目标</option>{t.targets.map(target=><option key={target.id} value={target.id}>{target.title} · {target.detail}</option>)}</select></label>
  {t.player?.script&&<p>AI规则已接管指挥 · 目标仍可预览 <button onClick={()=>void t.openAiEditor()}>查看当前 AI 规则</button></p>}
  <button aria-pressed={t.tacticalPicking} disabled={!t.actor||!t.isOwner} onClick={()=>t.setTacticalPicking(!t.tacticalPicking)}>{t.tacticalPicking?'结束地图选取':'在地图选择目标'}</button>
  {t.tacticalPicking&&<p>点选{t.action==='repair'?'己方受损设施':t.action==='claim'?'控制点房间':'敌方守卫'}只锁定目标，确认后才下令。</p>}
  <button disabled={!t.enabled} onClick={()=>void t.submit()}>确认{tacticalLabels[t.action]}</button>
  <p className="tactical-short" title={t.target?.detail}>{t.target?`${tacticalLabels[t.action]} · ${t.target.title}`:'先选择己方角色与目标'}</p>
  <details><summary>目标与行动详情</summary><p>{t.target?.detail??'没有选中目标'}{t.target&&<> · 对象编号 <code>{t.target.id}</code></>} {t.target&&<button className="text-button" onClick={()=>t.setSelectedRoom(t.target!.roomId)}>定位目标房间</button>}</p><p>{range===undefined?'范围由服务端判断':`作用距离 ${range/1000} 米`} · {cost}</p>
   {t.action==='repair'&&<p>库存 {t.player?.materials??0} 建材；携带材料不计入库存。</p>}
   {t.state&&<p>能量 {t.state.energy}/{t.state.maxEnergy} · 施法冷却 {Math.max(0,t.state.castReadyTick-s.tick)*(s.tickDurationMs??500)/1000} 秒</p>}
   {t.point&&<p>占领 {t.point.progressTicks}/{t.point.requiredTicks}{t.point.contested?' · 正在争夺':''}{t.point.blockedReason?` · ${reason(t.point.blockedReason)}`:''}</p>}
   {t.result&&<p role="status">最近结果：{tacticalLabels[t.result.action as TacticalActionKind]??'战斗'} · {phases[t.result.phase]??t.result.phase}{t.result.reasonCode?` · ${reason(t.result.reasonCode)}`:''}{t.result.values.hpAfter!==undefined?` · 生命 ${t.result.values.hpAfter}`:''}</p>}
   {t.action==='cast'&&!t.actor?.appearance.weapon&&<p>携带法杖后才可施放。</p>}
  </details>
  {t.error&&<p role="alert">{t.error}</p>}
 </section>;
}
