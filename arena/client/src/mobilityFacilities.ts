import { Container, Graphics, Text, type Texture } from "pixi.js";
import { project } from "./isoGeometry";
import type { Point3Milli } from "./mobilityTypes";
import type { Snapshot } from "./types";

export const mobilityPoint = (p: Point3Milli) => project(p.x / 1000, p.y / 1000, p.z / 1000);
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
export function paintMobilityFacilities(layer: Container, snapshot: Snapshot, _textures: Record<string, Texture>, onSelect: (edgeId: string) => void) {
  for (const edge of snapshot.worldMap?.mobilityEdges ?? []) {
    for (const support of edge.supports ?? []) {
      const from = mobilityPoint(support.from), to = mobilityPoint(support.to);
      layer.addChild(selectable(new Graphics().moveTo(from.x, from.y).lineTo(to.x, to.y)
        .stroke({ color: 0x364c48, width: support.widthMilli / 1000 * 42 })
        .stroke({ color: 0xbfa970, width: 2 }), edge.edgeId, onSelect));
      for (const end of [support.from, support.to]) {
        const high = mobilityPoint(end), low = mobilityPoint({ ...end, z: 0 });
        layer.addChild(new Graphics().moveTo(low.x, low.y).lineTo(high.x, high.y).stroke({ color: 0x998c69, width: 6 }));
      }
    }
    for (const segment of edge.segments) {
      if (segment.role === "ladder") {
        const from = mobilityPoint(segment.from), to = mobilityPoint(segment.to);
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
      const p = mobilityPoint(anchor);
      const marker = new Graphics().ellipse(p.x, p.y, edge.landingRadiusMilli / 1000 * 64, edge.landingRadiusMilli / 1000 * 32)
        .fill({ color: teal, alpha: 0.2 }).stroke({ color: teal, width: 2 });
      layer.addChild(selectable(marker, edge.edgeId, onSelect));
      const roomId = index === 0 ? edge.fromRoomId : edge.toRoomId;
      const name = snapshot.rooms.find((room) => room.id === roomId)?.name ?? roomId;
      label(layer, `${edge.kind === "jump" ? "跃桥踏板" : "梯道端点"} · ${name}`, p);
    }
  }
}

