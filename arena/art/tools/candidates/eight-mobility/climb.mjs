import { articulate } from "./articulation.mjs";
/** 250mm alternating contacts match the ladder's half-cycle rung spacing. */
export const climbStride = 0.5;
export function climbPoses(direction) {
  const poses = [];
  for (const descending of [false, true])
    for (let frame = 0; frame < 8; frame++) {
      const phase = frame / 8,
        ankles = {},
        wrists = {},
        contacts = {};
      for (const [side, offset] of [
        ["left", 0],
        ["right", 0.5],
      ]) {
        const p = (phase + offset) % 1,
          support = p < 0.5,
          swing = (p - 0.5) * 2;
        const foot = descending
          ? support
            ? -0.15 + climbStride * p
            : 0.1 - 0.25 * swing
          : support
            ? 0.1 - climbStride * p
            : -0.15 + 0.25 * swing + 0.1 * Math.sin(Math.PI * swing);
        const hand = descending
          ? support
            ? 0.85 + climbStride * p
            : 1.1 - 0.25 * swing
          : support
            ? 1.1 - climbStride * p
            : 0.85 + 0.25 * swing;
        ankles[side] = [0.14, foot];
        wrists[side] = [0.2, hand];
        contacts[side] = {
          support,
          rootDistance: climbStride * phase,
          rootHeight: (descending ? -1 : 1) * climbStride * phase,
          footHeight: foot,
          handHeight: hand,
        };
      }
      poses.push(
        articulate(direction, {
          hipZ: 0.45,
          lean: 0.04,
          ankles,
          wrists,
          phase: descending ? "descend" : "grip",
          contacts,
          staffAngle: direction.stowedStaffAngle ?? 18,
          durationMs: frame % 4 === 3 ? 70 : 60,
        }),
      );
    }
  for (let frame = 0; frame < 8; frame++) {
    const u = frame / 7;
    poses.push(
      articulate(direction, {
        hipZ: 0.45 + 0.18 * u,
        lean: 0.14 * (1 - u),
        ankles: {
          left: [0.14 - 0.14 * u, -0.05 + 0.16 * u],
          right: [-0.02, 0.11],
        },
        wrists: { left: [0.2, 0.9 - 0.12 * u], right: [0.18, 0.88 - 0.1 * u] },
        phase: "crest",
        contacts: { transferProgress: u },
        staffAngle: direction.stowedStaffAngle ?? 18,
        durationMs: frame % 4 === 3 ? 70 : 60,
      }),
    );
  }
  return poses;
}
