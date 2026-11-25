import type { Actor, Snapshot } from "./types.ts";

const stateNames: Record<string, string> = {
  idle: "等待指令",
  queued: "待出发",
  construction: "施工中",
  complete: "任务完成",
  completed: "任务完成",
  failed: "任务失败",
  travelling: "前往目标",
  building: "施工中",
  waiting: "等待条件",
  cataloging: "驻守编目",
  returning: "运返回库",
  recovering: "据点恢复",
  downed: "倒地",
  blocked: "任务受阻",
  moving: "前往目标",
  gathering: "采集藏材",
  transporting: "运返中庭",
  delivering: "藏材入库",
  fighting: "迎战威胁",
  retreating: "撤退休整",
  defending: "守卫书库",
  guarding: "守卫书库",
  scouting: "巡查书库",
};
export const stateName = (value = "idle") => stateNames[value] || value;

/** Presentation facts only: travelling actors have not joined work at either endpoint. */
export function actorActivity(actor: Actor, snapshot: Snapshot) {
  const travel = actor.travel;
  const targetRoomId = travel?.targetRoomId ?? actor.task?.target;
  const destination = snapshot.rooms.find((room) => room.id === targetRoomId);
  const warehouse = snapshot.buildings.some((building) =>
    building.roomId === targetRoomId && building.owner === actor.owner &&
    building.kind === "warehouse" && (building.hp ?? 1) > 0 &&
    (building.constructionTicks ?? 0) >= (building.requiredTicks ?? 0));
  const returning = !!travel && actor.cargo > 0 &&
    (destination?.kind === "base" || warehouse);
  const atTarget = !travel && actor.roomId === targetRoomId;
  const method = actor.locomotion ? ({ walk: "步行", run: "疾跑", jump: "跃桥", climb: "攀梯" }[actor.locomotion.kind]) : "";
  const phase = actor.locomotion ? ({ walk: "", run: "", takeoff: "起跳", airborne: "腾空", landing: "落地", grip: "握梯", descend: "下梯", crest: "翻越", traverse: "高廊行进" }[actor.locomotion.phase]) : "";
  const remainingMicros = travel?.segments
    ? travel.segments.slice(travel.segment).reduce((sum, segment) => sum + segment.durationMicros, 0) - (travel.segmentElapsedMicros ?? 0)
    : undefined;
  const etaSeconds = travel ? Math.ceil(Math.max(0, remainingMicros !== undefined ? remainingMicros / 1000000
    : (travel.totalDistanceMilli - travel.distanceMilli) / travel.speedMilliPerTick * (snapshot.tickDurationMs ?? 500) / 1000)) : 0;
  const title = actor.hp <= 0 ? "倒地" : travel
    ? returning ? "携材返仓" : actor.task?.kind === "guard" ? "前往支援" : "前往目标"
    : stateName(actor.state);
  const detail = travel
    ? `${[method, phase, title, destination?.name ?? targetRoomId].filter(Boolean).join(" · ")}`
    : actor.task ? `${destination?.name ?? targetRoomId} · ${stateName(actor.task.stage)}`
    : "选择任务与目的地开始行动";
  return { title, detail, method, phase, etaSeconds, targetRoomId, presentRoomId: travel ? undefined : actor.roomId, returning, atTarget, travelling: !!travel };
}
