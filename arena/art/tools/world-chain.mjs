// Solve in an orthonormal authoring plane; callers choose limb names and embed the plane in world space.
export function solveTwoSegment({
  lengthA,
  lengthB,
  start,
  target,
  branch = 1,
  basis,
}) {
  const delta = target.map((value, i) => value - start[i]),
    distance = Math.hypot(...delta);
  if (
    !distance ||
    distance > lengthA + lengthB ||
    distance < Math.abs(lengthA - lengthB)
  )
    throw Error(
      `World chain target unreachable: distance ${distance}, segments ${lengthA},${lengthB}`,
    );
  const along =
    (lengthA * lengthA - lengthB * lengthB + distance * distance) /
    (2 * distance);
  const perpendicular = Math.sqrt(
    Math.max(0, lengthA * lengthA - along * along),
  );
  const unit = delta.map((value) => value / distance),
    normal = [-unit[1], unit[0]];
  const hinge = start.map(
    (value, i) => value + along * unit[i] + branch * perpendicular * normal[i],
  );
  const points = { start, hinge, end: target };
  const world = basis
    ? Object.fromEntries(
        Object.entries(points).map(([name, p]) => [
          name,
          basis.origin.map((v, i) => v + basis.u[i] * p[0] + basis.v[i] * p[1]),
        ]),
      )
    : null;
  return {
    ...points,
    world,
    lengthA: Math.hypot(...hinge.map((value, i) => value - start[i])),
    lengthB: Math.hypot(...target.map((value, i) => value - hinge[i])),
  };
}
