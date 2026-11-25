import type { Actor, Command, Snapshot } from "./types";

export type MobilityChoice =
  | { kind: "run"; viaRoomId: string; roomId: string }
  | { kind: "jump" | "climb"; edgeId: string }
  | null;

/** Enumerate the authority's ordinary two-edge topology, never a screen-space route. */
export function runChoices(snapshot: Snapshot, fromRoomId: string) {
  const links = snapshot.worldMap?.links ?? [];
  const adjacent = (id: string) => links.flatMap((edge) =>
    edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : []);
  const first = adjacent(fromRoomId);
  return first.flatMap((viaRoomId) => adjacent(viaRoomId)
    .filter((roomId) => roomId !== fromRoomId && !first.includes(roomId))
    .map((roomId) => ({ viaRoomId, roomId })));
}

export function mobilityCommand(snapshot: Snapshot, actor: Actor, choice: MobilityChoice): Command | null {
  if (!choice) return null;
  if (choice.kind === "run") {
    return runChoices(snapshot, actor.roomId).some((route) =>
      route.viaRoomId === choice.viaRoomId && route.roomId === choice.roomId)
      ? { type: "run", actorId: actor.id, viaRoomId: choice.viaRoomId, roomId: choice.roomId } : null;
  }
  const edge = snapshot.worldMap?.mobilityEdges?.find((edge) =>
    edge.edgeId === choice.edgeId && edge.kind === choice.kind);
  return edge && (edge.fromRoomId === actor.roomId || edge.toRoomId === actor.roomId)
    ? { type: choice.kind, actorId: actor.id, edgeId: choice.edgeId } : null;
}
