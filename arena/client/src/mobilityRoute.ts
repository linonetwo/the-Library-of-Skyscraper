import { project } from "./isoGeometry.ts";
import type { TravelSegment } from "./mobilityTypes";
type RoutePen = {moveTo(x:number,y:number): RoutePen;lineTo(x:number,y:number):RoutePen};
const point = (p: {x:number;y:number;z:number}) => project(p.x/1000,p.y/1000,p.z/1000);
export function arrow(line: RoutePen, from: { x: number; y: number }, to: { x: number; y: number }) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  for (const turn of [-0.55, 0.55]) line.moveTo(to.x - Math.cos(angle + turn) * 14, to.y - Math.sin(angle + turn) * 14).lineTo(to.x, to.y);
}

export function segmentPath(line: RoutePen, source: TravelSegment[], reverse = false) {
  const segments = reverse ? [...source].reverse().map((segment) => ({ ...segment, from: segment.to, to: segment.from })) : source;
  segments.forEach((segment, index) => {
    // A vertical route overlay obscures the actual rungs and hand/boot contact.
    // Restart each visible segment so omitted ladders never become connecting chords.
    if (segment.role === "ladder") return;
    const from = point(segment.from);
    line.moveTo(from.x, from.y);
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

