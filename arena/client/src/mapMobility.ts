import { Container, Graphics } from "pixi.js";
import { project } from "./isoGeometry";
import type { TravelSegment } from "./mobilityTypes";
import type { Actor, Snapshot } from "./types";
import type { MobilityChoice } from "./mobilityChoices";
import { mobilityPoint as point } from "./mobilityFacilities";

const gold = 0xf2d493;
function arrow(line: Graphics, from: { x: number; y: number }, to: { x: number; y: number }) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  for (const turn of [-0.55, 0.55]) line.moveTo(to.x - Math.cos(angle + turn) * 14, to.y - Math.sin(angle + turn) * 14).lineTo(to.x, to.y);
}

function segmentPath(line: Graphics, source: TravelSegment[], reverse = false) {
  const segments = reverse ? [...source].reverse().map((segment) => ({ ...segment, from: segment.to, to: segment.from })) : source;
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
  if (!actor || (snapshot.simulationVersion ?? 0) < 7) return;
  if (actor.travel) {
    const current = new Graphics();
    if (actor.travel.segments) segmentPath(current, actor.travel.segments);
    else actor.travel.path.forEach((p, index) => {
      const q = project(p.x, p.y);
      if (index === 0) current.moveTo(q.x, q.y); else current.lineTo(q.x, q.y);
    });
    current.stroke({ color: 0x89c8bd, width: 3, alpha: 0.8 });
    current.eventMode = "none";
    layer.addChild(current);
  }
  if (!choice) return;
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
    if (edge) segmentPath(line, edge.segments, actor.roomId === edge.toRoomId);
  }
  line.stroke({ color: gold, width: 4, alpha: 0.9 });
  line.eventMode = "none";
  layer.addChild(line);
}
