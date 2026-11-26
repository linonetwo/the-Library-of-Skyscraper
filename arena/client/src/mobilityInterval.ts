import type { Actor } from "./types";
import type { Locomotion } from "./mobilityTypes";
type Sample = Pick<Actor, "travel" | "worldPosition" | "worldHeightMilli" | "locomotion" | "motionDistanceMilli">;
const point = (sample: Sample) => ({ x: sample.worldPosition!.x * 1000, y: sample.worldPosition!.y * 1000, z: sample.worldHeightMilli! });
/** Interpolate only the received interval, cut at committed segment boundaries. */
export function sampleTravelInterval(previous: Sample | undefined, current: Sample, fraction: number) {
  const a = previous?.travel, b = current.travel;
  if (!previous || !a || !b || a.travelId !== b.travelId || a.segment >= b.segment ||
      !b.segments || a.segmentElapsedMicros === undefined || b.segmentElapsedMicros === undefined) return undefined;
  const t = Math.max(0, Math.min(1, fraction));
  if (t === 1) return undefined;
  let duration = b.segmentElapsedMicros - a.segmentElapsedMicros;
  for (let i = a.segment; i < b.segment; i++) duration += b.segments[i].durationMicros;
  if (duration === 0) return undefined;
  let elapsed = a.segmentElapsedMicros + duration * t;
  let index = a.segment;
  let prefix = a.distanceMilli - b.segments[index].lengthMilli * a.segmentElapsedMicros / b.segments[index].durationMicros;
  while (index < b.segment && elapsed >= b.segments[index].durationMicros) {
    elapsed -= b.segments[index].durationMicros;
    prefix += b.segments[index].lengthMilli;
    index++;
  }
  const segment = b.segments[index];
  const start = index === a.segment ? a.segmentElapsedMicros : 0;
  const end = index === b.segment ? b.segmentElapsedMicros : segment.durationMicros;
  const f = (elapsed - start) / (end - start);
  const lerp = (from: number, to: number) => from + (to - from) * f;
  const from = index === a.segment ? point(previous) : segment.from;
  const to = index === b.segment ? point(current) : segment.to;
  const startDistance = index === a.segment ? a.distanceMilli : prefix;
  const endDistance = index === b.segment ? b.distanceMilli : prefix + segment.lengthMilli;
  const distance = lerp(startDistance, endDistance);
  const jumpPhase = previous.locomotion?.kind === "jump" ? previous.locomotion.phase
    : current.locomotion?.kind === "jump" ? current.locomotion.phase : "airborne";
  const phase: Locomotion["phase"] = segment.role === "transfer" ? "crest"
    : segment.role === "ladder" ? (segment.to.z > segment.from.z ? "grip" : "descend")
    : segment.role === "traverse" ? "traverse"
    : segment.kind === "jump" ? jumpPhase : segment.kind === "run" ? "run" : "walk";
  const u = elapsed / segment.durationMicros;
  return { segmentIndex: index,
    worldPosition: { x: lerp(from.x, to.x) / 1000, y: lerp(from.y, to.y) / 1000 },
    worldHeightMilli: lerp(from.z, to.z),
    motionDistanceMilli: (previous.motionDistanceMilli ?? 0) + distance - a.distanceMilli,
    locomotionDistanceMilli: segment.lengthMilli * u,
    locomotion: { kind: segment.kind, phase, progress: u } satisfies Locomotion,
  };
}
