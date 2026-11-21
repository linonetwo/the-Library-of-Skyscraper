import { solveWorldLeg, projectWorldLeg } from "./world-leg.mjs";
export const worldWalkRegistration = {
  upper: 0.3187701178,
  lower: 0.3060520193,
  hipZ: 0.66,
  ankleZ: 0.11,
  trackWidth: 0.18,
  worldSpeed: 1.5,
  cycleMs: 720,
  cycleStride: 1.08,
};
export function worldWalkPose(
  direction,
  phase,
  { origin = [96, 172.8], swingLift = 0.08, registration = {} } = {},
) {
  const r = { ...worldWalkRegistration, ...registration },
    heading = direction === "NE" ? [0, -1] : [0, 1],
    legs = {};
  for (const side of ["left", "right"]) {
    const offset = side === "left" ? 0 : 0.5,
      p = (phase + offset) % 1;
    const s =
      p < 0.5
        ? r.cycleStride / 4 - r.cycleStride * p
        : -r.cycleStride / 4 + r.cycleStride * (p - 0.5);
    const z =
      r.ankleZ + (p < 0.5 ? 0 : swingLift * Math.sin(Math.PI * (p - 0.5) * 2));
    const solve = solveWorldLeg({
      upper: r.upper,
      lower: r.lower,
      hip: [0, r.hipZ],
      ankle: [s, z],
    });
    legs[side] = {
      ...solve,
      ...projectWorldLeg(solve, {
        heading,
        lateral: ((side === "left" ? -1 : 1) * r.trackWidth) / 2,
        origin,
      }),
      support: p < 0.5,
    };
  }
  return {
    phase,
    rootScreenDelta: (direction === "NE"
      ? [69.12, -34.56]
      : [-69.12, 34.56]
    ).map((v) => v * phase),
    legs,
  };
}

export function auditWorldCycle(
  direction,
  footDefinitions,
  origin = [96, 172.8],
  registration = {},
) {
  const frames = [],
    anchors = {},
    cycle = direction === "NE" ? [69.12, -34.56] : [-69.12, 34.56];
  let previous = null;
  for (let frame = 0; frame <= 32; frame++) {
    const phase = frame / 16,
      pose = worldWalkPose(direction, phase, { origin, registration }),
      side = phase % 1 < 0.5 ? "left" : "right";
    const foot = footDefinitions[side],
      ankle = pose.legs[side].screen.ankle,
      delta = cycle.map((v) => v * phase);
    const soleScreen = ankle.map(
      (v, i) => v + foot.soleOffset[i] + delta[i] - origin[i],
    );
    const soleWorld = [
      (soleScreen[0] / 64 + soleScreen[1] / 32) / 2,
      (soleScreen[1] / 32 - soleScreen[0] / 64) / 2,
      0,
    ];
    if (previous !== side) anchors[side] = soleWorld;
    const errorWorld = Math.hypot(
      ...soleWorld.map((v, i) => v - anchors[side][i]),
    );
    frames.push({
      frame,
      cycle: Math.floor(phase),
      phase: phase % 1,
      support: side,
      soleGroundWorld: soleWorld,
      plantGroundWorld: anchors[side],
      errorWorld,
    });
    previous = side;
  }
  const first = worldWalkPose(direction, 0, { origin, registration }),
    seam = worldWalkPose(direction, 1, { origin, registration });
  const seamScreenError = Math.max(
    ...["left", "right"].flatMap((side) =>
      ["hip", "knee", "ankle"].map((id) =>
        Math.hypot(
          ...first.legs[side].screen[id].map(
            (v, i) => v - seam.legs[side].screen[id][i],
          ),
        ),
      ),
    ),
  );
  return {
    direction,
    worldBones: { ...worldWalkRegistration, ...registration },
    frames,
    maxSoleWorldError: Math.max(...frames.map((f) => f.errorWorld)),
    seamScreenError,
    cycleScreenDelta: cycle,
    frameHoldScreenResidual: Math.hypot(...cycle) / 16,
  };
}
