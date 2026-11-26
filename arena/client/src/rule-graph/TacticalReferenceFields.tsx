import type { EnemyRef, OwnBuildingRef } from "../../../shared/tactical";
import { useArena } from "../ArenaWorkspace";
import { buildingNames } from "../ExpeditionTasks";
import { GraphReference } from "./GraphReference";
import { GraphRoomSelect } from "./GraphRoomSelect";

export function EnemyReferenceFields({ value, onChange }: { value: EnemyRef; onChange: (value: EnemyRef) => void }) {
  const { snapshot } = useArena();
  return <>
    <label>敌方目标方式<select aria-label="敌方目标方式" value={value.type} onChange={event => onChange(event.target.value === "enemy" ? { type: "enemy", enemyId: "" } : { type: "enemyInRoom", roomId: "", select: "lowestHp" })}>
      <option value="enemy">指定敌人</option><option value="enemyInRoom">房间内生命最低的敌人</option>
    </select></label>
    {value.type === "enemyInRoom" ? <GraphRoomSelect label="目标敌人房间" value={value.roomId} onChange={roomId => onChange({ ...value, roomId })} /> :
      <GraphReference label="指定敌人" value={value.enemyId} onChange={enemyId => onChange({ ...value, enemyId })} items={(snapshot?.enemies ?? []).map(enemy => ({ id: enemy.id, name: `${snapshot?.rooms.find(room => room.id === enemy.roomId)?.name ?? enemy.roomId} · HP ${enemy.hp}/${enemy.maxHp} · ${enemy.id}` }))} />}
  </>;
}

export function OwnBuildingReferenceFields({ value, onChange }: { value: OwnBuildingRef; onChange: (value: OwnBuildingRef) => void }) {
  const { snapshot, session } = useArena();
  const buildings = snapshot?.buildings.filter(building => building.owner === session?.playerId) ?? [];
  return <>
    <label>己方建筑目标方式<select aria-label="己方建筑目标方式" value={value.type} onChange={event => onChange(event.target.value === "ownBuilding" ? { type: "ownBuilding", buildingId: "" } : { type: "ownBuildingInRoom", roomId: "", select: "mostDamaged" })}>
      <option value="ownBuilding">指定己方建筑</option><option value="ownBuildingInRoom">房间内受损最重的己方建筑</option>
    </select></label>
    {value.type === "ownBuildingInRoom" ? <GraphRoomSelect label="目标建筑房间" value={value.roomId} onChange={roomId => onChange({ ...value, roomId })} /> :
      <GraphReference label="指定己方建筑" value={value.buildingId} onChange={buildingId => onChange({ ...value, buildingId })} items={buildings.map(building => ({ id: building.id, name: `${building.kind === "core" ? "基地" : buildingNames[building.kind]} · ${snapshot?.rooms.find(room => room.id === building.roomId)?.name ?? building.roomId} · ${building.id}` }))} />}
  </>;
}
