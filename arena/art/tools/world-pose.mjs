import { worldWalkPose } from "./world-walk.mjs";

export function applyWorldLegs(
  state,
  direction,
  heading,
  phase,
  origin,
  registration,
) {
  const world = worldWalkPose(heading, phase, { origin, registration }),
    mapping = {},
    ratios = [];
  for (const [side, leg] of Object.entries(world.legs)) {
    const ids = [side + "Hip", side + "Knee", side + "Ankle"];
    for (const [i, label] of ["hip", "knee", "ankle"].entries())
      state[ids[i]] = { ...state[ids[i]], point: leg.screen[label] };
    for (const [index, name] of ["thigh", "shin"].entries()) {
      const source = direction.joints[ids[index + 1]].restOffset,
        target = leg.screen[index ? "ankle" : "knee"].map(
          (v, i) => v - leg.screen[index ? "knee" : "hip"][i],
        );
      const sourceLength = Math.hypot(...source),
        targetLength = Math.hypot(...target),
        scale = targetLength / sourceLength;
      state[ids[index]].angle =
        Math.atan2(target[1], target[0]) - Math.atan2(source[1], source[0]);
      mapping[side + "-" + name] = { axis: source, scale };
      ratios.push({
        side,
        segment: name,
        worldLength: index ? leg.lowerLength : leg.upperLength,
        source: direction.joints[ids[index + 1]].cell.map(
          (v, i) => v - direction.joints[ids[index]].cell[i],
        ),
        sourceStart: direction.joints[ids[index]].cell,
        targetStart: leg.screen[index ? "knee" : "hip"],
        targetEnd: leg.screen[index ? "ankle" : "knee"],
        sourceLength,
        targetLength,
        scale,
      });
    }
    state[ids[2]].angle = 0;
  }
  return { state, mapping, ratios, world };
}
