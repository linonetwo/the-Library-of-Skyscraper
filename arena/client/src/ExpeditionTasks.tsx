import { useState } from "react";
import { useArena } from "./ArenaWorkspace";
import type { BuildingKind, TaskKind } from "./types";
export const taskNames: Record<TaskKind, string> = {
  gather: "采集运输",
  build: "建设",
  guard: "护卫编目",
  return: "返回据点",
};
export const buildingNames: Record<BuildingKind, string> = {
  warehouse: "前线仓库",
  tower: "防御塔",
  catalog: "编目台",
};
export default function ExpeditionTasks() {
  const { actor, snapshot, command, ready, isOwner, player } = useArena();
  const [kind, setKind] = useState<TaskKind>("gather");
  const [building, setBuilding] = useState<BuildingKind>("catalog");
  if (!actor || !snapshot) return null;
  const target =
    snapshot.scenarioConfig?.targetRoomId ??
    snapshot.rooms.find((r) => r.kind === "ruins")?.id;
  const rooms =
    kind === "return"
      ? snapshot.rooms.filter((r) => r.kind === "base")
      : kind === "gather"
        ? snapshot.rooms.filter((r) => r.resources > 0)
        : snapshot.rooms.filter((r) => r.kind !== "base");
  return (
    <div className="task-picker">
      <div className="task-kinds">
        {(Object.keys(taskNames) as TaskKind[]).map((key) => (
          <button
            key={key}
            className={kind === key ? "selected" : ""}
            onClick={() => setKind(key)}
          >
            {taskNames[key]}
          </button>
        ))}
      </div>
      {kind === "build" && (
        <div className="build-kinds">
          {(Object.keys(buildingNames) as BuildingKind[]).map((key) => (
            <button
              key={key}
              className={building === key ? "selected" : ""}
              onClick={() => setBuilding(key)}
            >
              {buildingNames[key]} ·{" "}
              {snapshot.scenarioConfig?.buildingCosts?.[key] ??
                (key === "warehouse" ? 20 : 25)}
              材
            </button>
          ))}
        </div>
      )}
      <div className="task-targets">
        <small>选择目的地即下令</small>
        {rooms.map((room) => (
          <button
            key={room.id}
            disabled={!ready || !isOwner || actor.hp <= 0}
            onClick={() =>
              void command({
                type: "task",
                actorId: actor.id,
                kind,
                target: room.id,
                ...(kind === "build" ? { buildingKind: building } : {}),
              })
            }
          >
            {room.name}
            {room.id === target ? " ★" : ""}
            {kind === "gather" ? ` · ${room.resources}材` : ""}
          </button>
        ))}
      </div>
      {player?.script && (
        <small className="risk-text">
          此角色由脚本驱动；手动任务冲突会显示服务器原因。
        </small>
      )}
    </div>
  );
}
