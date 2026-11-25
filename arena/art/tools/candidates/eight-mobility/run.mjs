import { articulate } from "./articulation.mjs";
export const runStride = 1.5;
export function runPoses(direction) {
  return Array.from({ length: 16 }, (_, i) => {
    const phase = (30 * i + (i > 7 ? 10 : 0)) / 500,
      ankles = {},
      wrists = {},
      contacts = {};
    let support = false;
    for (const [side, offset] of [
      ["left", 0],
      ["right", 0.5],
    ]) {
      const p = (phase + offset) % 1,
        stance = p < 0.36;
      const swing = (p - 0.36) / 0.64;
      ankles[side] = stance
        ? [0.27 - runStride * p, 0.11]
        : [
            -0.27 + 0.54 * (3 * swing ** 2 - 2 * swing ** 3),
            0.11 + 0.23 * Math.sin(Math.PI * swing),
          ];
      wrists[side] =
        side === "right"
          ? [
              -0.04 - 0.035 * Math.sin(2 * Math.PI * phase),
              0.77 + 0.025 * Math.cos(2 * Math.PI * phase),
            ]
          : [
              0.07 - 0.22 * Math.sin(2 * Math.PI * (phase + offset)),
              0.79 + 0.045 * Math.cos(2 * Math.PI * (phase + offset)),
            ];
      contacts[side] = {
        support: stance,
        soleHeight: ankles[side][1] - 0.11,
        rootDistance: runStride * phase,
      };
      support ||= stance;
    }
    return articulate(direction, {
      hipZ: support ? 0.64 : 0.67,
      lean: 0.15,
      ankles,
      wrists,
      phase: support ? "support-strike" : "flight",
      contacts,
      staffAngle: direction.worldForward[1] > 0 ? -18 : 18,
      durationMs: i === 7 || i === 15 ? 40 : 30,
    });
  });
}
