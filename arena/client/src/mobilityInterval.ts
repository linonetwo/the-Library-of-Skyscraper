import type { Actor } from "./types";
import type { Locomotion, TravelSegment } from "./mobilityTypes";
type Sample = Pick<Actor, "travel" | "worldPosition" | "worldHeightMilli" | "locomotion" | "motionDistanceMilli">;
type Span = { index: number; duration: number; startDistance: number; endDistance: number; startU: number; endU: number; from: {x:number;y:number;z:number}; to: {x:number;y:number;z:number}; phase: Locomotion["phase"] };
const intervals = new WeakMap<object, { previous: Sample; spans: Span[] }>();
const point = (sample: Sample) => ({ x: sample.worldPosition!.x * 1000, y: sample.worldPosition!.y * 1000, z: sample.worldHeightMilli! });
function prepare(previous: Sample, current: Sample): Span[] {
  const a = previous.travel, b = current.travel;
  if (!a || !b || a.travelId !== b.travelId || a.segment >= b.segment || !a.segments || !b.segments ||
      !previous.worldPosition || previous.worldHeightMilli === undefined ||
      !previous.locomotion || !current.locomotion ||
      a.segmentElapsedMicros === undefined || b.segmentElapsedMicros === undefined ||
      JSON.stringify(a.segments.slice(0, b.segment + 1)) !== JSON.stringify(b.segments.slice(0, b.segment + 1))) return [];
  const spans: Span[] = [];
  let prefix = b.segments.slice(0, a.segment).reduce((sum, part) => sum + part.lengthMilli, 0);
  for (let i = a.segment; i <= b.segment; i++) {
    const segment = b.segments[i];
    if (!segment || !(segment.durationMicros > 0)) return [];
    const start = i === a.segment ? a.segmentElapsedMicros : 0;
    const end = i === b.segment ? b.segmentElapsedMicros : segment.durationMicros;
    if (end < start) return [];
    const phase = i === a.segment ? previous.locomotion.phase : i === b.segment ? current.locomotion.phase
      : segment.role === "transfer" ? "crest" : segment.role === "ladder" ? (segment.to.z < segment.from.z ? "descend" : "grip")
      : segment.kind === "jump" ? "airborne" : segment.kind === "run" ? "run" : "walk";
    spans.push({ index: i, duration: end - start,
      startDistance: i === a.segment ? a.distanceMilli : prefix,
      endDistance: i === b.segment ? b.distanceMilli : prefix + segment.lengthMilli,
      startU: start / segment.durationMicros, endU: end / segment.durationMicros,
      from: i === a.segment ? point(previous) : segment.from,
      to: i === b.segment ? point(current) : segment.to, phase });
    prefix += segment.lengthMilli;
  }
  return spans;
}
/** Only the already received interval, cut at committed segment boundaries. No extrapolation or arc reconstruction. */
export function sampleTravelInterval(previous: Sample | undefined, current: Sample, fraction: number) {
  if (!previous || !current.travel || previous.travel?.segment === current.travel.segment) return undefined;
  let interval = intervals.get(current.travel);
  if (!interval || interval.previous !== previous) {
    interval = { previous, spans: prepare(previous, current) };
    intervals.set(current.travel, interval);
  }
  if (!interval.spans.length) return undefined;
  const t = Math.max(0, Math.min(1, fraction));
  if (t === 1) return undefined; // Exact current authority sample at the boundary.
  let time = interval.spans.reduce((sum, span) => sum + span.duration, 0) * t;
  for (const span of interval.spans) {
    if (time >= span.duration) { time -= span.duration; continue; }
    const f = time / span.duration;
    const lerp = (a: number, b: number) => a + (b - a) * f;
    const segment: TravelSegment = current.travel.segments![span.index];
    const u = lerp(span.startU, span.endU);
    const distance = lerp(span.startDistance, span.endDistance);
    return { segmentIndex: span.index,
      worldPosition: { x: lerp(span.from.x, span.to.x) / 1000, y: lerp(span.from.y, span.to.y) / 1000 },
      worldHeightMilli: lerp(span.from.z, span.to.z),
      motionDistanceMilli: (previous.motionDistanceMilli ?? 0) + distance - previous.travel!.distanceMilli,
      locomotionDistanceMilli: segment.lengthMilli * u,
      locomotion: { kind: segment.kind, phase: span.phase, progress: u } satisfies Locomotion,
    };
  }
  return undefined;
}
