import type { CompositionModule } from "../../../behavior-modules/graph";
import { roleNames } from "../types";
import { GraphRoomSelect } from "./GraphRoomSelect";
const names = { scout: "侦察", patrol: "巡逻", escort: "护送" };
export function CompositionModuleFields({ module: m, onChange }: { module: CompositionModule; onChange: (module: CompositionModule) => void }) {
  return <fieldset>
    <legend>{names[m.kind]} · {m.moduleId}</legend>
    <label><input type="checkbox" checked={m.enabled} onChange={event => onChange({ ...m, enabled: event.target.checked })} />启用模块</label>
    <label>优先级<input aria-label="模块优先级" type="number" value={m.priority} onChange={event => onChange({ ...m, priority: Number(event.target.value) })} /></label>
    <fieldset><legend>执行岗位</legend>{Object.entries(roleNames).map(([role, name]) => <label key={role}><input type="checkbox" checked={!m.roleFilter || m.roleFilter.includes(role as keyof typeof roleNames)} onChange={event => {
      const current = m.roleFilter ?? Object.keys(roleNames) as (keyof typeof roleNames)[];
      onChange({ ...m, roleFilter: event.target.checked ? [...current, role as keyof typeof roleNames] : current.filter(value => value !== role) });
    }} />{name} · {role}</label>)}</fieldset>
    {m.kind === "scout" && <>
      <GraphRoomSelect label="侦察房间" value={m.config.target.roomId} onChange={roomId => onChange({ ...m, config: { ...m.config, target: { type: "room", roomId } } })} />
      <label>可容忍敌方生命<input aria-label="可容忍敌方生命" type="number" min="0" value={m.config.maxEnemyHp} onChange={event => onChange({ ...m, config: { ...m.config, maxEnemyHp: Number(event.target.value) } })} /></label>
      <label>回报间隔拍数<input aria-label="回报间隔拍数" type="number" min="0" value={m.config.reportIntervalTicks} onChange={event => onChange({ ...m, config: { ...m.config, reportIntervalTicks: Number(event.target.value) } })} /></label>
    </>}
    {m.kind === "patrol" && <>
      {m.config.rooms.map((room, index) => <div key={index}>
        <GraphRoomSelect label={`巡逻站点 ${index + 1}`} value={room.roomId} onChange={roomId => onChange({ ...m, config: { ...m.config, rooms: m.config.rooms.map((value, i) => i === index ? { type: "room", roomId } : value) } })} />
        <button onClick={() => onChange({ ...m, config: { ...m.config, rooms: m.config.rooms.filter((_, i) => i !== index) } })}>删除站点 {index + 1}</button>
      </div>)}
      <button onClick={() => onChange({ ...m, config: { ...m.config, rooms: [...m.config.rooms, { type: "room", roomId: "" }] } })}>添加巡逻站点</button>
      <label>驻留拍数<input aria-label="驻留拍数" type="number" min="0" value={m.config.dwellTicks} onChange={event => onChange({ ...m, config: { ...m.config, dwellTicks: Number(event.target.value) } })} /></label>
    </>}
    {m.kind === "escort" && <>
      <label>受护岗位<select aria-label="受护岗位" value={m.config.target.role} onChange={event => onChange({ ...m, config: { ...m.config, target: { type: "ownRole", role: event.target.value as typeof m.config.target.role } } })}>{Object.entries(roleNames).map(([role, name]) => <option key={role} value={role}>{name} · {role}</option>)}</select></label>
      <label>最低货量<input aria-label="最低货量" type="number" min="0" value={m.config.minCargo} onChange={event => onChange({ ...m, config: { ...m.config, minCargo: Number(event.target.value) } })} /></label>
    </>}
  </fieldset>;
}
