import { articulate } from "./articulation.mjs";
const stages = [
  {
    phase: "prep",
    hip: 0.45,
    feet: [
      [-0.06, 0.11],
      [0.08, 0.11],
    ],
    wrists: [-0.13, 0.78],
    lean: 0.16,
  },
  {
    phase: "takeoff",
    hip: 0.59,
    feet: [
      [-0.1, 0.11],
      [0.02, 0.11],
    ],
    wrists: [0.06, 0.96],
    lean: 0.14,
  },
  {
    phase: "takeoff",
    hip: 0.71,
    feet: [
      [-0.1, 0.12],
      [-0.04, 0.16],
    ],
    wrists: [0.2, 1.08],
    lean: 0.13,
  },
  {
    phase: "airborne",
    hip: 0.65,
    feet: [
      [-0.23, 0.3],
      [-0.14, 0.36],
    ],
    wrists: [0.22, 1.05],
    lean: 0.08,
  },
  {
    phase: "airborne",
    hip: 0.64,
    feet: [
      [-0.1, 0.35],
      [0.05, 0.29],
    ],
    wrists: [0.2, 1.03],
    lean: 0.04,
  },
  {
    phase: "airborne",
    hip: 0.67,
    feet: [
      [0.18, 0.16],
      [0.06, 0.21],
    ],
    wrists: [0.17, 0.99],
    lean: 0.06,
  },
  {
    phase: "landing",
    hip: 0.49,
    feet: [
      [0.13, 0.11],
      [-0.02, 0.11],
    ],
    wrists: [0.13, 0.86],
    lean: 0.18,
  },
  {
    phase: "landing",
    hip: 0.62,
    feet: [
      [0.05, 0.11],
      [-0.03, 0.11],
    ],
    wrists: [0.05, 0.84],
    lean: 0.03,
  },
];
export function jumpPoses(direction) {
  return stages.map((stage) =>
    articulate(direction, {
      hipZ: stage.hip,
      lean: stage.lean,
      ankles: { left: stage.feet[0], right: stage.feet[1] },
      wrists: {
        left: stage.wrists,
        right: [-0.05, Math.min(0.89, stage.wrists[1] - 0.12)],
      },
      phase: stage.phase,
      contacts: {
        left: {
          support: stage.feet[0][1] === 0.11,
          soleHeight: stage.feet[0][1] - 0.11,
        },
        right: {
          support: stage.feet[1][1] === 0.11,
          soleHeight: stage.feet[1][1] - 0.11,
        },
      },
      staffAngle: direction.worldForward[1] > 0 ? -18 : 18,
      durationMs: 250,
    }),
  );
}
