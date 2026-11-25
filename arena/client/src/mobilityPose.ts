import type { Actor } from "./types";
import type { Locomotion } from "./mobilityTypes";
import { project } from "./isoGeometry.ts";
import { facing } from "./directions.ts";
import type { Direction } from "./directions";
type Sample = Pick<
  Actor,
  | "worldPosition"
  | "worldHeightMilli"
  | "motionDistanceMilli"
  | "lastMoveDirection"
  | "locomotion"
  | "travel"
>;
/** Only presentation between two received authority samples; no route/physics advance. */
export function sampleMobilityPose(
  previous: Sample | undefined,
  current: Sample,
  fraction: number,
  snap = false,
) {
  if (!current.worldPosition || current.worldHeightMilli === undefined)
    return undefined;
  const sameSegment =
    !snap &&
    previous?.worldPosition &&
    previous.worldHeightMilli !== undefined &&
    current.travel &&
    previous.travel?.travelId === current.travel.travelId &&
    previous.travel.segment === current.travel.segment &&
    previous.locomotion?.kind === current.locomotion?.kind;
  const t = sameSegment ? Math.max(0, Math.min(1, fraction)) : 1;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const worldPosition = {
    x: lerp(
      previous?.worldPosition?.x ?? current.worldPosition.x,
      current.worldPosition.x,
    ),
    y: lerp(
      previous?.worldPosition?.y ?? current.worldPosition.y,
      current.worldPosition.y,
    ),
  };
  const worldHeightMilli = lerp(
    previous?.worldHeightMilli ?? current.worldHeightMilli,
    current.worldHeightMilli,
  );
  const motionDistanceMilli = lerp(
    previous?.motionDistanceMilli ?? current.motionDistanceMilli ?? 0,
    current.motionDistanceMilli ?? 0,
  );
  const locomotion: Locomotion | undefined = current.locomotion
    ? {
        ...current.locomotion,
        progress: lerp(
          previous?.locomotion?.progress ?? current.locomotion.progress,
          current.locomotion.progress,
        ),
      }
    : undefined;
  const vector = current.lastMoveDirection;
  const direction: Direction = vector
    ? facing({ x: 0, y: 0 }, project(vector.x, vector.y))
    : "S";
  const segment = current.travel?.segments?.[current.travel.segment];
  // A ladder casts to its foot floor. Transfer and high walkway are bearing platforms.
  const supportHeightMilli =
    segment?.role === "transfer" || segment?.role === "traverse"
      ? Math.min(segment.from.z, segment.to.z)
      : 0;
  const prefixDistance =
    current.travel?.segments
      ?.slice(0, current.travel.segment)
      .reduce((sum, part) => sum + part.lengthMilli, 0) ?? 0;
  const locomotionDistanceMilli = Math.max(
    0,
    lerp(
      previous?.travel?.distanceMilli ?? current.travel?.distanceMilli ?? 0,
      current.travel?.distanceMilli ?? 0,
    ) - prefixDistance,
  );
  return {
    ...project(worldPosition.x, worldPosition.y, worldHeightMilli / 1000),
    worldPosition,
    worldHeightMilli,
    supportHeightMilli,
    motionDistanceMilli,
    locomotionDistanceMilli,
    locomotion,
    direction,
    moving: !!current.travel,
    frame: 0,
  };
}
