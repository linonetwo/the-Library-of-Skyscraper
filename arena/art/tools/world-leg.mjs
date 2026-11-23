import { solveTwoSegment } from "./world-chain.mjs";
// Fixed anatomical lengths in the heading/height plane. Projection length is allowed to change.
export function solveWorldLeg({ upper, lower, hip, ankle }) {
  const chain = solveTwoSegment({
    lengthA: upper,
    lengthB: lower,
    start: hip,
    target: ankle,
    branch: 1,
  });
  return {
    hip: chain.start,
    knee: chain.hinge,
    ankle: chain.end,
    upperLength: chain.lengthA,
    lowerLength: chain.lengthB,
  };
}
export function projectWorldLeg(
  leg,
  { heading, lateral, origin, zScale = 78.38367177 },
) {
  const side = [-heading[1], heading[0]];
  const world = Object.fromEntries(
    ["hip", "knee", "ankle"].map((id) => [
      id,
      [
        heading[0] * leg[id][0] + side[0] * lateral,
        heading[1] * leg[id][0] + side[1] * lateral,
        leg[id][1],
      ],
    ]),
  );
  const screen = Object.fromEntries(
    Object.entries(world).map(([id, [x, y, z]]) => [
      id,
      [origin[0] + 64 * (x - y), origin[1] + 32 * (x + y) - zScale * z],
    ]),
  );
  return {
    world,
    screen,
    upperScreenLength: Math.hypot(
      ...screen.knee.map((v, i) => v - screen.hip[i]),
    ),
    lowerScreenLength: Math.hypot(
      ...screen.ankle.map((v, i) => v - screen.knee[i]),
    ),
  };
}
