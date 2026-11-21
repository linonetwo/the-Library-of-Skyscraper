const rotate = ([x, y], a) => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const angle = (v) => Math.atan2(v[1], v[0]);
const length = (v) => Math.hypot(...v);
const degrees = (r) => (r * 180) / Math.PI;
export function skeleton(joints, pose, origin) {
  const result = {};
  function resolve(id) {
    if (result[id]) return result[id];
    const joint = joints[id],
      parent = joint.parent
        ? resolve(joint.parent)
        : { point: origin, angle: 0 };
    const change = pose[id] || {};
    const point = add(
      parent.point,
      rotate(add(joint.restOffset, change.offset || [0, 0]), parent.angle),
    );
    result[id] = {
      point,
      angle: parent.angle + ((change.rotation || 0) * Math.PI) / 180,
    };
    return result[id];
  }
  for (const id of Object.keys(joints)) resolve(id);
  return result;
}
export function solveLimb(direction, pose, origin, chain, target) {
  const joints = direction.joints,
    endId = chain.joint,
    midId = joints[endId].parent,
    startId = joints[midId].parent;
  let state = skeleton(joints, pose, origin);
  const endAngle = state[endId].angle;
  const destination = sub(target, rotate(chain.soleOffset || [0, 0], endAngle));
  const hip = state[startId],
    v = sub(destination, hip.point),
    l1 = length(joints[midId].restOffset),
    l2 = length(joints[endId].restOffset),
    d = length(v);
  if (!l1 || !l2 || !d)
    throw Error("Limb pose requires a nondegenerate two-segment chain");
  if (d > l1 + l2 + 0.01 || d < Math.abs(l1 - l2) - 0.01)
    throw Error(
      `Limb target unreachable: ${endId} distance ${d.toFixed(2)} lengths ${l1},${l2}`,
    );
  const bend = chain.bend === -1 ? -1 : 1;
  const startAngle =
    angle(v) +
    bend *
      Math.acos(
        Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))),
      );
  const knee = add(hip.point, [
    l1 * Math.cos(startAngle),
    l1 * Math.sin(startAngle),
  ]);
  const midAngle = angle(sub(destination, knee));
  const parent = joints[startId].parent;
  pose[startId] = {
    ...pose[startId],
    rotation: degrees(
      startAngle -
        angle(joints[midId].restOffset) -
        (parent ? state[parent].angle : 0),
    ),
  };
  state = skeleton(joints, pose, origin);
  pose[midId] = {
    ...pose[midId],
    rotation: degrees(
      midAngle - angle(joints[endId].restOffset) - state[startId].angle,
    ),
  };
  state = skeleton(joints, pose, origin);
  pose[endId] = {
    ...pose[endId],
    rotation: degrees(endAngle - state[midId].angle),
  };
  return skeleton(joints, pose, origin);
}
