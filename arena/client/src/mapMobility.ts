import { Container, Graphics, Text } from "pixi.js";
import { project } from "./isoGeometry";
import type { Point3Milli, MobilityEdge } from "./mobilityTypes";
import type { Actor, Snapshot } from "./types";
import type { MobilityChoice } from "./mobilityChoices";

const point = (p: Point3Milli) => project(p.x / 1000, p.y / 1000, p.z / 1000);
const gold = 0xf2d493;
const teal = 0x89c8bd;
function selectable(node: Graphics, edgeId: string, onSelect: (edgeId: string) => void) {
  node.eventMode = "static";
  node.cursor = "pointer";
  node.on("pointertap", (event) => { event.stopPropagation(); onSelect(edgeId); });
  return node;
}

function label(layer: Container, text: string, p: { x: number; y: number }) {
  const node = new Text({ text, style: { fontFamily: "serif", fontSize: 12, fill: gold, stroke: { color: 0x10262b, width: 4 } } });
  node.anchor.set(0.5, 1);
  node.position.set(p.x, p.y - 16);
  node.eventMode = "none";
  layer.addChild(node);
}

/** Static registered geometry shares the map world transform; it never advances an actor. */
export function paintMobilityFacilities(layer: Container, snapshot: Snapshot, onSelect: (edgeId: string) => void) {
  for (const edge of snapshot.worldMap?.mobilityEdges ?? []) {
    for (const support of edge.supports ?? []) {
      const from = point(support.from), to = point(support.to);
      layer.addChild(selectable(new Graphics().moveTo(from.x, from.y).lineTo(to.x, to.y)
        .stroke({ color: 0x364c48, width: support.widthMilli / 1000 * 42 })
        .stroke({ color: 0xbfa970, width: 2 }), edge.edgeId, onSelect));
      for (const end of [support.from, support.to]) {
        const high = point(end), low = point({ ...end, z: 0 });
        layer.addChild(new Graphics().moveTo(low.x, low.y).lineTo(high.x, high.y).stroke({ color: 0x998c69, width: 6 }));
      }
    }
    for (const segment of edge.segments) {
      if (segment.role === "ladder") {
        const from = point(segment.from), to = point(segment.to);
        const ladder = new Graphics();
        for (const offset of [-10, 10]) ladder.moveTo(from.x + offset, from.y).lineTo(to.x + offset, to.y).stroke({ color: 0xbfa970, width: 3 });
        for (let u = 0; u <= 1; u += 0.125) {
          const x = from.x + (to.x - from.x) * u, y = from.y + (to.y - from.y) * u;
          ladder.moveTo(x - 10, y).lineTo(x + 10, y).stroke({ color: 0xbfa970, width: 2 });
        }
        layer.addChild(selectable(ladder, edge.edgeId, onSelect));
      }
    }
    const first = edge.segments[0]?.from, last = edge.segments.at(-1)?.to;
    for (const [index, anchor] of [first, last].entries()) {
      if (!anchor) continue;
      const p = point(anchor);
      const marker = new Graphics().ellipse(p.x, p.y, edge.landingRadiusMilli / 1000 * 64, edge.landingRadiusMilli / 1000 * 32)
        .fill({ color: teal, alpha: 0.2 }).stroke({ color: teal, width: 2 });
      layer.addChild(selectable(marker, edge.edgeId, onSelect));
      const roomId = index === 0 ? edge.fromRoomId : edge.toRoomId;
      const name = snapshot.rooms.find((room) => room.id === roomId)?.name ?? roomId;
      label(layer, `${edge.kind === "jump" ? "跃桥踏板" : "梯道端点"} · ${name}`, p);
    }
  }
}

function arrow(line: Graphics, from: { x: number; y: number }, to: { x: number; y: number }) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  for (const turn of [-0.55, 0.55]) line.moveTo(to.x - Math.cos(angle + turn) * 14, to.y - Math.sin(angle + turn) * 14).lineTo(to.x, to.y);
}

function edgePath(line: Graphics, edge: MobilityEdge, reverse: boolean) {
  const segments = reverse ? [...edge.segments].reverse().map((segment) => ({ ...segment, from: segment.to, to: segment.from })) : edge.segments;
  segments.forEach((segment, index) => {
    const from = point(segment.from);
    if (index === 0) line.moveTo(from.x, from.y);
    // An arc is a route diagram, not the actor's sampled height or position.
    for (let step = 1; step <= 12; step++) {
      const u = step / 12;
      const p = point({ x: segment.from.x + (segment.to.x - segment.from.x) * u,
        y: segment.from.y + (segment.to.y - segment.from.y) * u,
        z: segment.from.z + (segment.to.z - segment.from.z) * u + 4 * (segment.arcHeightMilli ?? 0) * u * (1 - u) });
      line.lineTo(p.x, p.y);
    }
    if (index === segments.length - 1) arrow(line, from, point(segment.to));
  });
}

export function paintMobilitySelection(layer: Container, snapshot: Snapshot, actor: Actor | undefined, choice: MobilityChoice) {
  if (!actor || !choice) return;
  const line = new Graphics();
  if (choice.kind === "run") {
    const ids = [actor.roomId, choice.viaRoomId, choice.roomId];
    for (let i = 1; i < ids.length; i++) {
      const edge = snapshot.worldMap?.links.find((link) => link.from === ids[i - 1] && link.to === ids[i] || link.to === ids[i - 1] && link.from === ids[i]);
      if (!edge) continue;
      const points = edge.from === ids[i - 1] ? edge.points : [...edge.points].reverse();
      points.forEach((p, index) => {
        const q = project(p.x, p.y);
        if (index === 0) line.moveTo(q.x, q.y); else line.lineTo(q.x, q.y);
      });
      if (points.length > 1) arrow(line, project(points.at(-2)!.x, points.at(-2)!.y), project(points.at(-1)!.x, points.at(-1)!.y));
    }
  } else {
    const edge = snapshot.worldMap?.mobilityEdges?.find((edge) => edge.edgeId === choice.edgeId);
    if (edge) edgePath(line, edge, actor.roomId === edge.toRoomId);
  }
  line.stroke({ color: gold, width: 4, alpha: 0.9 });
  line.eventMode = "none";
  layer.addChild(line);
}
