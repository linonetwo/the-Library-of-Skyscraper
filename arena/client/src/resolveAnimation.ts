import {sampleCast} from "./tacticalAnimation.ts";
import { facing, type Direction } from "./directions.ts";
import { project } from "./isoGeometry.ts";
import type { ActionCue, Actor, WorldPoint } from "./types";

import {
  animationCatalog,
  type RegisteredClip,
  type CrestFrameKey,
  type Clip,
} from "./animationCatalog.ts";
import { frameAt, clipDuration } from "./animationTiming.ts";
export type { Clip } from "./animationCatalog.ts";
export type AnimationEntity = Pick<
  Actor,
  | "hp"
  | "actionCue"
  | "impactCue"
  | "lastMoveDirection"
  | "worldPosition"
  | "state"
> &
  Partial<Pick<Actor, "cargo" | "task" | "locomotion">>;
export type AnimationMotion = {
  readonly crestFrameKey?: CrestFrameKey;
  readonly climbDirection?: Direction;
  readonly segmentRole?: import("./mobilityTypes").SegmentRole;
  tacticalState?: import("../../shared/tactical").TacticalActorSnapshot;
  tacticalTargetPosition?: WorldPoint;
  moving: boolean;
  direction: Direction;
  tickDurationMs: number;
  worldPosition?: WorldPoint;
  motionDistanceMilli: number;
  locomotionDistanceMilli?: number;
};
export type AnimationSelection = {
  clip: Clip;
  direction: Direction;
  elapsedMs: number;
  cueDurationMs?: number;
  holdLast?: boolean;
  motionDistanceMilli: number;
  locomotionDistanceMilli?: number;
  impact: boolean;
  locomotion?: Actor["locomotion"];
  readonly crestFrameKey?: CrestFrameKey;
  readonly tacticalFrame?: number;
};

export function cueActive(
  cue: ActionCue | null | undefined,
  simTimeMs: number,
  tickDurationMs: number,
) {
  if (!cue) return false;
  const start = cue.startedTick * tickDurationMs;
  return (
    simTimeMs >= start &&
    (cue.durationTicks === 0 ||
      simTimeMs < start + cue.durationTicks * tickDurationMs)
  );
}

/** Chooses semantic actions only; unsupported clips are never registered as finished art. */
function selectAnimation(
  actor: AnimationEntity,
  simTimeMs: number,
  motion: AnimationMotion,
  castRegistration?: RegisteredClip,
): AnimationSelection {
  const tickMs = motion.tickDurationMs;
  const action = actor.actionCue;
  const impact =
    actor.impactCue ??
    (action?.kind === "hit" || action?.kind === "down" ? action : null);
  const actionActive = cueActive(action, simTimeMs, tickMs);
  const impactActive = cueActive(impact, simTimeMs, tickMs);
  const vector = actor.lastMoveDirection;
  let direction = vector
    ? facing({ x: 0, y: 0 }, project(vector.x, vector.y))
    : motion.direction;
  const result = (
    clip: Clip,
    startMs = 0,
    cue?: ActionCue | null,
  ): AnimationSelection => ({
    clip,
    direction: clip === "climb" ? motion.climbDirection ?? direction : direction,
    elapsedMs: Math.max(0, simTimeMs - startMs),
    cueDurationMs:
      cue && cue.durationTicks > 0 ? cue.durationTicks * tickMs : undefined,
    motionDistanceMilli: motion.motionDistanceMilli,
    locomotionDistanceMilli: motion.locomotionDistanceMilli,
    impact: !!impactActive && impact?.kind === "hit",
    locomotion: actor.locomotion,
    crestFrameKey: motion.crestFrameKey,
  });
  if (actor.hp <= 0 || actor.state === "downed") {
    const down = impact?.kind === "down" ? impact : undefined;
    return {
      ...result("down", (down?.startedTick ?? 0) * tickMs, down),
      holdLast: !down,
    };
  }
  const aim = () => {
    const position = motion.worldPosition ?? actor.worldPosition;
    if (action?.targetPosition && position &&
        (action.targetPosition.x !== position.x || action.targetPosition.y !== position.y)) {
      direction = facing(
        project(position.x, position.y),
        project(action.targetPosition.x, action.targetPosition.y),
      );
    }
  };
  if (impactActive && impact?.kind === "hit") {
    if (actionActive && action?.kind === "attack") aim();
    return result("hit", impact.startedTick * tickMs, impact);
  }
  const cast=sampleCast(motion.tacticalState,simTimeMs,tickMs,castRegistration?.phaseFrames);
  if(cast){
    const target=motion.tacticalTargetPosition,position=motion.worldPosition??actor.worldPosition;
    if(target&&position&&(target.x!==position.x||target.y!==position.y))direction=facing(project(position.x,position.y),project(target.x,target.y));
    return {...result("cast"),tacticalFrame:cast.frame};
  }
  if (actionActive && action?.kind === "attack") {
    aim();
    return result("attack", action.startedTick * tickMs, action);
  }
  if (actionActive && action?.kind === "deliver") {
    aim();
    return result("unload", action.startedTick * tickMs, action);
  }
  if (actor.locomotion && ["run","jump","climb"].includes(actor.locomotion.kind)) return result(actor.locomotion.kind as Clip);
  if (motion.moving || (motion.segmentRole === "traverse" && actor.locomotion?.kind === "walk")) return result(actor.cargo ? "carry" : "walk");
  if (actionActive && action?.kind === "gather") {
    aim();
    return result("collect", action.startedTick * tickMs, action);
  }
  const working =
    actor.task?.stage === "construction" || actor.task?.stage === "cataloging";
  if (working) {
    return result(
      actor.task?.stage === "construction" ? "build" : "catalog",
      (actor.task?.stageStartedTick ?? action?.startedTick ?? 0) * tickMs,
    );
  }
  return result("idle");
}

export function resolveAnimation(
  actor: AnimationEntity,
  simTimeMs: number,
  motion: AnimationMotion,
  catalog: Partial<Record<Clip, RegisteredClip>> = animationCatalog,
) {
  const selection = selectAnimation(actor, simTimeMs, motion, catalog.cast);
  const requested = catalog[selection.clip];
  const clip = requested && (!requested.directions || requested.directions.includes(selection.direction))
    ? selection.clip
    : selection.clip === "carry"
      ? "walk"
      : "idle";
  const spec = catalog[clip]!;
  const duration = clipDuration(spec);
  const elapsed = spec.cycleWorldStride
    ? (selection.motionDistanceMilli / 1000 / spec.cycleWorldStride) * duration
    : selection.cueDurationMs
      ? (selection.elapsedMs / selection.cueDurationMs) * duration
      : selection.elapsedMs;
  const phase = selection.locomotion?.phase;
  const phaseRange = phase && (phase === "crest" && selection.crestFrameKey
    ? spec.phaseFrames?.[selection.crestFrameKey] ?? spec.phaseFrames?.crest
    : spec.phaseFrames?.[phase]);
  const mobilityU = selection.locomotion?.progress;
  // Ladder and transfer ranges are one pass over this segment, including its end.
  const onePass = phase === "grip" || phase === "descend" || phase === "crest";
  const phaseU = phaseRange?.cycleDistanceMilli && !onePass
    ? ((selection.locomotionDistanceMilli ?? selection.motionDistanceMilli) % phaseRange.cycleDistanceMilli) / phaseRange.cycleDistanceMilli
    : Math.max(0, Math.min(1, mobilityU ?? 0));
  const phaseFrame = phaseRange
    ? phaseRange.first + Math.min(phaseRange.last - phaseRange.first,
        Math.floor(phaseU * (phaseRange.last - phaseRange.first + 1)))
    : clip === "jump" && mobilityU !== undefined
      ? frameAt(spec, Math.max(0, Math.min(1, mobilityU)) * duration) : undefined;
  const frame = (clip===selection.clip?selection.tacticalFrame:undefined) ?? phaseFrame ?? (selection.holdLast
    ? spec.frameCount - 1
    : frameAt(spec, elapsed));
  return { ...selection, requestedClip: selection.clip, clip, frame };
}
