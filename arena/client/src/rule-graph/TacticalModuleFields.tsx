import type { TacticalModule } from "../../../behavior-modules/graph";
import { roleNames } from "../types";
import { GraphRoomSelect } from "./GraphRoomSelect";
import { EnemyReferenceFields, OwnBuildingReferenceFields } from "./TacticalReferenceFields";
const names = { attack: "定点攻击", repair: "维修建筑", claim: "争夺据点", cast: "施放墨印" };
export function TacticalModuleFields({ module: m, onChange }: { module: TacticalModule; onChange: (module: TacticalModule) => void }) {
  return <fieldset className="composition-module-fields">
    <legend>{names[m.kind]} · {m.moduleId}</legend>
    <label><input type="checkbox" checked={m.enabled} onChange={event => onChange({ ...m, enabled: event.target.checked })} />启用模块</label>
    <label>优先级<input aria-label="模块优先级" type="number" value={m.priority} onChange={event => onChange({ ...m, priority: Number(event.target.value) })} /></label>
    <fieldset><legend>执行岗位</legend>{Object.entries(roleNames).map(([role, name]) => <label key={role}><input type="checkbox" checked={!m.roleFilter || m.roleFilter.includes(role as keyof typeof roleNames)} onChange={event => {
      const current = m.roleFilter ?? Object.keys(roleNames) as (keyof typeof roleNames)[];
      onChange({ ...m, roleFilter: event.target.checked ? [...current, role as keyof typeof roleNames] : current.filter(value => value !== role) });
    }} />{name} · {role}</label>)}</fieldset>
    {m.kind === "attack" && <EnemyReferenceFields value={m.config.target} onChange={target => onChange({ ...m, config: { target } })} />}
    {m.kind === "repair" && <OwnBuildingReferenceFields value={m.config.target} onChange={target => onChange({ ...m, config: { target } })} />}
    {m.kind === "claim" && <GraphRoomSelect label="争夺据点房间" value={m.config.target.roomId} onChange={roomId => onChange({ ...m, config: { target: { type: "controlPoint", roomId } } })} />}
    {m.kind === "cast" && <><p>技能：墨印</p><EnemyReferenceFields value={m.config.target} onChange={target => onChange({ ...m, config: { ...m.config, target } })} /></>}
  </fieldset>;
}
