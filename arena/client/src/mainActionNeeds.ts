import type { Snapshot } from "./types";
import type { Clip } from "./animationCatalog";
import { cueActive } from "./resolveAnimation.ts";
/** Current facts across the whole squad precede prewarming its next assigned work. */
export function neededMainActions(snapshot: Pick<Snapshot, "actors" | "enemies" | "tick" | "tickDurationMs" | "tactics">): Clip[] {
  const needed = new Set<Clip>(), actors = snapshot.actors;
  const tickMs = snapshot.tickDurationMs || 500;
  const active = (cue: typeof actors[number]["actionCue"], kind: string) => cue?.kind === kind && cueActive(cue,snapshot.tick*tickMs,tickMs);
  if (actors.some(a => a.hp <= 0 || a.state === "downed") || snapshot.tactics?.actorStates.some(state=>state.recovery)) needed.add("down");
  if (actors.some(a => active(a.impactCue,"hit") || active(a.actionCue,"hit"))) needed.add("hit");
  if(snapshot.tactics?.actorStates.some(state=>state.recovery))needed.add("recover");
  if(snapshot.tactics?.actorStates.some(state=>state.cast))needed.add("cast");
  if (actors.some(a => active(a.actionCue,"attack") || a.state === "fighting")) needed.add("attack");
  if (actors.some(a => active(a.actionCue,"deliver"))) needed.add("unload");
  if (actors.some(a => active(a.actionCue,"gather") || a.state === "gathering")) needed.add("collect");
  if (actors.some(a => a.task?.stage === "construction")) needed.add("build");
  if (actors.some(a => a.task?.stage === "cataloging")) needed.add("catalog");
  for (const actor of actors.filter(a => a.hp > 0)) {
    for (const segment of actor.travel?.segments?.slice(actor.travel.segment) ?? [])
      if (segment.kind !== "walk") needed.add(segment.kind);
    if (actor.locomotion && actor.locomotion.kind !== "walk") needed.add(actor.locomotion.kind);
    const threatened = snapshot.enemies?.some(e => e.hp > 0 && (e.roomId === actor.roomId || e.roomId === actor.travel?.targetRoomId));
    if (threatened || actor.task?.kind === "guard" || active(actor.impactCue,"hit"))
      for (const action of ["attack", "hit", "down"] as const) needed.add(action);
    if (actor.task?.kind === "gather" || active(actor.actionCue,"gather") || actor.cargo > 0)
      for (const action of ["collect", "carry", "unload"] as const) needed.add(action);
    if (actor.task?.kind === "build") {
      needed.add("build");
      if (actor.task.buildingKind === "catalog") needed.add("catalog");
    }
  }
  if(snapshot.tactics?.actorStates.some(state=>state.weapon==="staff"))needed.add("cast");
  return [...needed];
}
