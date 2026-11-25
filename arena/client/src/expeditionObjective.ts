import { actorActivity } from "./actorActivity.ts";
import type { Actor, Player, Snapshot } from "./types.ts";
import { roleNames } from "./types.ts";
import { reasonName } from "./scenarioLabels.ts";

export type ExpeditionObjective = { title: string; detail: string; roomId?: string };

export function expeditionObjective(snapshot: Snapshot, player?: Player): ExpeditionObjective {
  const target = snapshot.rooms.find((room) => room.id === snapshot.scenarioConfig?.targetRoomId)
    ?? snapshot.rooms.find((room) => room.kind === "ruins");
  const roomId = target?.id;
  if (!player) return { title: "观察远征", detail: "选择己方队员查看当前任务", roomId };
  const actors = snapshot.actors.filter((a) => a.owner === player.id);
  const living = actors.filter((a) => a.hp > 0);
  const label = (a: Actor) => roleNames[a.role];
  const cargo = actors.filter((a) => a.cargo > 0).map((a) => {
    const { returning } = actorActivity(a, snapshot);
    return `${label(a)}携带${a.cargo}${returning ? "返程" : "运输中"}`;
  }).join("；");
  const latest = [...snapshot.events].reverse().find((event) => event.playerId === player.id);
  let result = latest ? latest.message : "尚无行动结果";
  const names = [
    ...snapshot.actors.map((a) => [a.id, roleNames[a.role]] as const),
    ...snapshot.rooms.map((room) => [room.id, room.name] as const),
    ...(snapshot.enemies ?? []).map((e) => [e.id, "书库守卫"] as const),
  ].sort((a, b) => b[0].length - a[0].length);
  for (const [id, name] of names) result = result.split(id).join(name);
  for (const [kind, name] of [["catalog", "编目台"], ["warehouse", "前线仓库"], ["tower", "防御塔"]]) result = result.split(kind).join(name);
  const finish = (title: string, executing: Actor[], focus = roomId): ExpeditionObjective => ({
    title,
    detail: `${executing.length ? executing.map((actor) => `${label(actor)}${actor.travel ? `：${actorActivity(actor, snapshot).detail}` : ""}`).join("、") : "尚无存活执行者"} · ${cargo || `库存${player.materials}材`} · ${result}`,
    roomId: focus,
  });
  if (snapshot.phase === "settled" || snapshot.result) return finish(
    snapshot.result ? `${snapshot.result.winner === player.id ? "远征胜利" : "远征结束"} · ${reasonName(snapshot.result.reason)}` : "远征结算中",
    living,
  );
  if (snapshot.paused && snapshot.tick === 0) {
    if (player.script) {
      const tasks = actors.map((a) => `${label(a)}：${a.task
        ? ({gather:"采集运输",build:"建设编目台",guard:"护卫编目",return:"返回据点"}[a.task.kind])
        : "等待AI首拍"}`).join("；");
      return { title: "AI规则已接管 → 开始远征",
        detail: `已发布 ${player.script.sourceHash.slice(0, 8)} · ${tasks}`, roomId };
    }
    const assigned = actors.length > 0 && actors.every((a) => a.task);
    return { title: assigned ? "分工已就绪 → 开始远征" : "准备远征 → 推荐分工 → 开始远征",
      detail: actors.map((a) => `${label(a)}：${a.task ? ({gather:"采集运输",build:"建设编目台",guard:"护卫编目",return:"返回据点"}[a.task.kind]) : "待分工"}`).join("；"), roomId };
  }
  const enemies = (snapshot.enemies ?? []).filter((e) => e.hp > 0);
  const guardians = enemies.filter((e) => e.roomId === roomId);
  const hp = snapshot.enemies ? guardians.reduce((sum, e) => sum + e.hp, 0) : target?.enemyHp ?? 0;
  const toward = (a: Actor, id: string | undefined) =>
    a.travel ? a.travel.targetRoomId === id : a.roomId === id;
  const defenders = living.filter((a) => toward(a, roomId));
  if (snapshot.scenario?.counterattackSpawned && enemies.length) {
    const threatRoom = enemies[0].roomId;
    return finish(`抵御反扑 · 敌方HP ${enemies.reduce((sum, e) => sum + e.hp, 0)}`, living.filter((a) => toward(a, threatRoom)), threatRoom);
  }
  if (hp > 0) return finish(`清除${target?.name ?? "目标书库"}守卫 · 剩余HP ${hp}`, defenders);
  const catalog = snapshot.buildings.find((b) => b.owner === player.id && b.kind === "catalog" && b.roomId === roomId && (b.hp ?? 1) > 0);
  const builders = living.filter((a) => toward(a, roomId) &&
    (a.travel || a.state === "building" || a.task?.kind === "build" && a.task.target === roomId && a.task.buildingKind === "catalog"));
  if (!catalog) {
    const cost = snapshot.scenarioConfig?.buildingCosts?.catalog ?? 25;
    if (player.materials < cost) {
      const gatherers = living.filter((a) => a.task?.kind === "gather" || a.cargo > 0);
      const focus = gatherers.find((a) => a.travel)?.travel?.targetRoomId ?? gatherers[0]?.task?.target ?? snapshot.rooms.find((r) => r.resources > 0)?.id;
      return finish(`采集并入库建材 · ${player.materials}/${cost}`, gatherers, focus);
    }
    return finish(`建设${target?.name ?? "目标书库"}编目台 · 库存${player.materials}/${cost}材`, builders);
  }
  if ((catalog.constructionTicks ?? 0) < (catalog.requiredTicks ?? 0)) return finish(`编目台施工${Math.floor((catalog.constructionTicks ?? 0) / catalog.requiredTicks! * 100)}% · 还需${Math.ceil((catalog.requiredTicks! - (catalog.constructionTicks ?? 0)) * (snapshot.tickDurationMs ?? 500) / 1000)}秒`, builders);
  const progress = snapshot.scenario?.catalogProgress ?? 0;
  const goal = snapshot.scenarioConfig?.catalogGoal ?? 60;
  const counter = snapshot.scenario?.counterattackTick;
  const countdown = counter != null && !snapshot.scenario?.counterattackSpawned
    ? ` · 反扑${Math.ceil(Math.max(0, counter - snapshot.tick) * (snapshot.tickDurationMs ?? 500) / 1000)}秒后抵达` : "";
  const objective = finish(`驻守编目 · ${progress}/${goal}${countdown}`, defenders);
  if (snapshot.scenario?.blockedReason) objective.detail += ` · ${reasonName(snapshot.scenario.blockedReason)}`;
  return objective;
}
